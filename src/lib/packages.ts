import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/lib/backend';

/**
 * Gói hosting (package): admin cấu hình ở /admin/packages và gán cho từng user.
 * - User chưa được gán gói dùng gói đánh dấu isDefault; chưa có gói mặc định thì dùng FALLBACK_PACKAGE.
 * - Admin không bị giới hạn.
 * Giới hạn CPU/RAM/database được gửi cho Vibe Core trước mỗi lần triển khai (pushResources),
 * Vibe Core ghi đè vào manifest K3s và tự chặn luồng có database nếu gói không cho phép.
 */

export type EffectivePackage = {
  id: string | null;
  name: string;
  description: string | null;
  maxProjects: number;
  cpuMillicores: number;
  memoryMi: number;
  allowDatabase: boolean;
  dbStorageGi: number;
  unlimited: boolean;
};

export const FALLBACK_PACKAGE: EffectivePackage = {
  id: null,
  name: 'Cơ bản',
  description: 'Gói mặc định khi admin chưa cấu hình gói nào',
  maxProjects: 3,
  cpuMillicores: 500,
  memoryMi: 512,
  allowDatabase: true,
  dbStorageGi: 1,
  unlimited: false,
};

const ADMIN_PACKAGE: EffectivePackage = {
  ...FALLBACK_PACKAGE,
  name: 'Quản trị (không giới hạn)',
  description: 'Tài khoản admin không bị giới hạn',
  unlimited: true,
};

type PackageRow = {
  id: string;
  name: string;
  description: string | null;
  maxProjects: number;
  cpuMillicores: number;
  memoryMi: number;
  allowDatabase: boolean;
  dbStorageGi: number;
};

function fromRow(row: PackageRow): EffectivePackage {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    maxProjects: row.maxProjects,
    cpuMillicores: row.cpuMillicores,
    memoryMi: row.memoryMi,
    allowDatabase: row.allowDatabase,
    dbStorageGi: row.dbStorageGi,
    unlimited: false,
  };
}

export async function getEffectivePackage(user: AuthUser): Promise<EffectivePackage> {
  if (user.role === 'admin') return ADMIN_PACKAGE;
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { package: true } });
  if (record?.package) return fromRow(record.package);
  const fallback = await prisma.package.findFirst({ where: { isDefault: true } });
  return fallback ? fromRow(fallback) : FALLBACK_PACKAGE;
}

export function resourcesFor(pkg: EffectivePackage) {
  return {
    cpu: `${pkg.cpuMillicores}m`,
    memory: `${pkg.memoryMi}Mi`,
    db_storage: `${pkg.dbStorageGi}Gi`,
    allow_database: pkg.allowDatabase,
  };
}

/** Chặn tạo app MỚI khi đã dùng hết số project của gói (triển khai lại app cũ vẫn được) */
export async function requireProjectQuota(
  user: AuthUser,
  appName: string,
  pkg?: EffectivePackage,
): Promise<NextResponse | null> {
  const effective = pkg ?? (await getEffectivePackage(user));
  if (effective.unlimited) return null;
  const existing = await prisma.project.findFirst({
    where: { userId: user.id, app_name: appName },
    select: { id: true },
  });
  if (existing) return null;
  const count = await prisma.project.count({ where: { userId: user.id } });
  if (count >= effective.maxProjects) {
    return NextResponse.json(
      {
        error: `Gói ${effective.name} cho phép tối đa ${effective.maxProjects} project, bạn đã dùng ${count}. Hãy xóa bớt project hoặc liên hệ admin để nâng gói.`,
        detail: `Đã đạt giới hạn ${effective.maxProjects} project của gói ${effective.name}.`,
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Gửi giới hạn của gói cho Vibe Core trước khi triển khai. Thất bại thì không cho triển khai,
 * để không có app nào chạy mà thiếu giới hạn.
 */
export async function pushResources(
  backendFetch: (path: string, init?: RequestInit) => Promise<Response>,
  appName: string,
  pkg: EffectivePackage,
): Promise<NextResponse | null> {
  if (pkg.unlimited) return null;
  try {
    const res = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resourcesFor(pkg)),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { error: `Không áp được giới hạn gói hosting: ${data?.detail || res.statusText}` },
      { status: 502 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Không kết nối được Vibe Core để áp giới hạn gói: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}

export function packageSummary(pkg: EffectivePackage) {
  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    unlimited: pkg.unlimited,
    maxProjects: pkg.unlimited ? null : pkg.maxProjects,
    cpu: pkg.unlimited ? null : `${pkg.cpuMillicores}m`,
    memory: pkg.unlimited ? null : `${pkg.memoryMi}Mi`,
    allowDatabase: pkg.allowDatabase,
    dbStorage: pkg.unlimited ? null : `${pkg.dbStorageGi}Gi`,
  };
}

/**
 * Áp lại giới hạn cho mọi app đang chạy của các user (khi admin đổi gói của user hoặc sửa một gói).
 * Trả về số app đã cập nhật và danh sách app lỗi.
 */
export async function reapplyForUsers(
  backendFetch: (path: string, init?: RequestInit) => Promise<Response>,
  userIds: string[],
): Promise<{ updated: number; failed: string[] }> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, projects: { select: { app_name: true } } },
  });
  let updated = 0;
  const failed: string[] = [];
  for (const u of users) {
    const pkg = await getEffectivePackage({ id: u.id, role: u.role });
    if (pkg.unlimited) continue;
    for (const p of u.projects) {
      const err = await pushResources(backendFetch, p.app_name, pkg);
      if (err) failed.push(p.app_name);
      else updated += 1;
    }
  }
  return { updated, failed };
}

/** User chịu ảnh hưởng khi một gói thay đổi: user được gán gói đó, cộng user chưa gán gói nếu đó là gói mặc định */
export async function usersOfPackage(packageId: string, isDefault: boolean): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: isDefault ? { OR: [{ packageId }, { packageId: null }] } : { packageId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
