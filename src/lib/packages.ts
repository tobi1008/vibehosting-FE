import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/lib/backend';
import {
  type Allocation,
  MIN_CPU_PER_PART,
  MIN_MEMORY_PER_PART,
  RESOURCE_PRESETS,
  partsFor,
  wantsDatabase,
} from '@/lib/resources';

export { type Allocation, MIN_CPU_PER_PART, MIN_MEMORY_PER_PART, RESOURCE_PRESETS, partsFor, wantsDatabase };

/**
 * Gói hosting (package): admin cấu hình ở /admin/packages và gán cho từng user.
 * - Gói là TỔNG tài nguyên của user: số project, tổng CPU, tổng RAM, tổng dung lượng database.
 * - Khi tạo project user chọn CPU/RAM/database cho app (AppAllocation) trong phần còn lại của gói,
 *   đổi lại được ở tab Cài đặt của project.
 * - User chưa được gán gói dùng gói đánh dấu isDefault; chưa có gói mặc định thì dùng FALLBACK_PACKAGE.
 * - Admin không bị giới hạn (vẫn chọn được mức cho app để AI không tự đặt).
 * Phần đã phân bổ được gửi cho Vibe Core (pushResources), Vibe Core chia đều cho các container của app,
 * ghi đè vào manifest K3s và tự chặn luồng có database nếu gói không cho phép.
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
  cpuMillicores: 1000,
  memoryMi: 1024,
  allowDatabase: true,
  dbStorageGi: 2,
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

/** User chịu ảnh hưởng khi một gói thay đổi: user được gán gói đó, cộng user chưa gán gói nếu đó là gói mặc định */
export async function usersOfPackage(packageId: string, isDefault: boolean): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: isDefault ? { OR: [{ packageId }, { packageId: null }] } : { packageId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ─────────────────────────── Phân bổ tài nguyên cho từng app ───────────────────────────

type BackendFetch = (path: string, init?: RequestInit) => Promise<Response>;

/** Tài nguyên đã phân bổ cho các app đang có project của user (bỏ qua app excludeApp) */
export async function allocatedFor(userId: string, excludeApp?: string): Promise<Allocation> {
  const projects = await prisma.project.findMany({ where: { userId }, select: { app_name: true } });
  const names = projects.map((p) => p.app_name).filter((n) => n !== excludeApp);
  const rows = names.length
    ? await prisma.appAllocation.findMany({ where: { userId, appName: { in: names } } })
    : [];
  return rows.reduce(
    (t, r) => ({
      cpuMillicores: t.cpuMillicores + r.cpuMillicores,
      memoryMi: t.memoryMi + r.memoryMi,
      dbStorageGi: t.dbStorageGi + r.dbStorageGi,
    }),
    { cpuMillicores: 0, memoryMi: 0, dbStorageGi: 0 },
  );
}

export async function remainingFor(user: AuthUser, pkg: EffectivePackage, excludeApp?: string): Promise<Allocation | null> {
  if (pkg.unlimited) return null;
  const used = await allocatedFor(user.id, excludeApp);
  return {
    cpuMillicores: Math.max(0, pkg.cpuMillicores - used.cpuMillicores),
    memoryMi: Math.max(0, pkg.memoryMi - used.memoryMi),
    dbStorageGi: Math.max(0, (pkg.allowDatabase ? pkg.dbStorageGi : 0) - used.dbStorageGi),
  };
}

export type AllocationRequest = {
  cpuMillicores?: unknown;
  memoryMi?: unknown;
  dbStorageGi?: unknown;
  arch?: string | null;
  dbType?: unknown;
  hasFrontend?: boolean;
};

/** Đọc mức tài nguyên user chọn từ body JSON hoặc FormData của route triển khai */
export function allocationRequestFrom(
  source: Record<string, unknown> | FormData,
  arch: string,
  extra: { dbType?: unknown; hasFrontend?: boolean } = {},
): AllocationRequest {
  const get = (k: string) => (source instanceof FormData ? source.get(k) : source?.[k]);
  return {
    cpuMillicores: get('cpu_millicores'),
    memoryMi: get('memory_mi'),
    dbStorageGi: get('db_storage_gi'),
    arch,
    dbType: extra.dbType ?? get('db_type'),
    hasFrontend: extra.hasFrontend,
  };
}

function toInt(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

const deny = (error: string, status = 403) => NextResponse.json({ error, detail: error }, { status });

/**
 * Xác định mức tài nguyên cho app khi triển khai: mức user chọn; không chọn thì giữ mức cũ của app
 * (triển khai lại), không có nữa thì mức "Nhỏ". Kiểm tra không vượt phần còn lại của gói rồi lưu lại.
 * Trả về { allocation, parts } hoặc NextResponse lỗi; null với admin không chọn mức (không giới hạn như cũ).
 */
export async function resolveAllocation(
  user: AuthUser,
  pkg: EffectivePackage,
  appName: string,
  req: AllocationRequest,
): Promise<{ allocation: Allocation; parts: number } | NextResponse | null> {
  const parts = partsFor(req.arch, req.dbType, req.hasFrontend ?? true);
  const db = wantsDatabase(req.dbType);
  const existing = await prisma.appAllocation.findUnique({ where: { appName } });
  let cpu = toInt(req.cpuMillicores);
  let mem = toInt(req.memoryMi);
  let disk = toInt(req.dbStorageGi);
  if (Number.isNaN(cpu) || Number.isNaN(mem) || Number.isNaN(disk)) return deny('Mức tài nguyên không hợp lệ.', 400);

  if (cpu === null || mem === null) {
    if (existing && existing.userId === user.id) {
      cpu = existing.cpuMillicores;
      mem = existing.memoryMi;
      disk = disk ?? existing.dbStorageGi;
    } else if (pkg.unlimited) {
      return null;
    } else {
      cpu = RESOURCE_PRESETS[0].cpuMillicores;
      mem = RESOURCE_PRESETS[0].memoryMi;
    }
  }
  if (!db) disk = 0;
  else if (!disk) disk = existing?.dbStorageGi || 1;

  if (cpu < parts * MIN_CPU_PER_PART || mem < parts * MIN_MEMORY_PER_PART) {
    return deny(
      `App này có ${parts} thành phần nên cần tối thiểu ${parts * MIN_CPU_PER_PART}m CPU và ${parts * MIN_MEMORY_PER_PART} MiB RAM.`,
      400,
    );
  }
  if (cpu > 64000 || mem > 262144 || disk > 1024) return deny('Mức tài nguyên quá lớn.', 400);
  if (existing && existing.dbStorageGi > disk && db) {
    return deny(`Không thể giảm dung lượng database (đang ${existing.dbStorageGi} GiB) vì ổ đĩa đã cấp không thu nhỏ được.`, 400);
  }

  const remaining = await remainingFor(user, pkg, appName);
  if (remaining) {
    const problems: string[] = [];
    if (cpu > remaining.cpuMillicores) problems.push(`CPU còn ${remaining.cpuMillicores}m`);
    if (mem > remaining.memoryMi) problems.push(`RAM còn ${remaining.memoryMi} MiB`);
    if (disk > remaining.dbStorageGi) problems.push(`dung lượng database còn ${remaining.dbStorageGi} GiB`);
    if (problems.length) {
      return deny(`Vượt tài nguyên còn lại của gói ${pkg.name}: ${problems.join(', ')}. Giảm mức của app này hoặc của app khác ở tab Cài đặt.`);
    }
  }
  return { allocation: { cpuMillicores: cpu, memoryMi: mem, dbStorageGi: disk }, parts };
}

export async function saveAllocation(userId: string, appName: string, allocation: Allocation, parts: number) {
  await prisma.appAllocation.upsert({
    where: { appName },
    create: { appName, userId, parts, ...allocation },
    update: { userId, parts, ...allocation },
  });
}

/**
 * Gửi phần tài nguyên đã phân bổ cho app tới Vibe Core (chia đều cho các container, áp ngay cho app đang chạy).
 * Thất bại thì không cho triển khai, để không có app nào chạy mà thiếu giới hạn.
 */
export async function pushResources(
  backendFetch: BackendFetch,
  appName: string,
  allocation: Allocation,
  parts: number,
  allowDatabase: boolean,
): Promise<NextResponse | null> {
  try {
    const res = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpu: `${allocation.cpuMillicores}m`,
        memory: `${allocation.memoryMi}Mi`,
        db_storage: `${Math.max(1, allocation.dbStorageGi)}Gi`,
        allow_database: allowDatabase,
        parts,
      }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return NextResponse.json(
      { error: `Không áp được giới hạn tài nguyên: ${data?.detail || res.statusText}` },
      { status: 502 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Không kết nối được Vibe Core để áp giới hạn tài nguyên: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}

/**
 * Khi gói của user thay đổi (đổi gói, sửa gói, xóa gói): nếu tổng đã phân bổ vượt gói mới thì thu nhỏ
 * CPU/RAM của các app theo cùng tỉ lệ (dung lượng database giữ nguyên vì không thu nhỏ được), rồi áp lại
 * cho các app đang chạy. Trả về số app đã cập nhật và danh sách app lỗi.
 */
export async function reapplyForUsers(
  backendFetch: BackendFetch,
  userIds: string[],
): Promise<{ updated: number; failed: string[] }> {
  let updated = 0;
  const failed: string[] = [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, projects: { select: { app_name: true } } },
  });
  for (const u of users) {
    const pkg = await getEffectivePackage({ id: u.id, role: u.role });
    const names = u.projects.map((p) => p.app_name);
    const rows = await prisma.appAllocation.findMany({ where: { userId: u.id, appName: { in: names } } });
    if (!rows.length) continue;
    const sumCpu = rows.reduce((t, r) => t + r.cpuMillicores, 0);
    const sumMem = rows.reduce((t, r) => t + r.memoryMi, 0);
    const cpuScale = !pkg.unlimited && sumCpu > pkg.cpuMillicores ? pkg.cpuMillicores / sumCpu : 1;
    const memScale = !pkg.unlimited && sumMem > pkg.memoryMi ? pkg.memoryMi / sumMem : 1;
    for (const r of rows) {
      const allocation = {
        cpuMillicores: Math.max(r.parts * MIN_CPU_PER_PART, Math.floor(r.cpuMillicores * cpuScale)),
        memoryMi: Math.max(r.parts * MIN_MEMORY_PER_PART, Math.floor(r.memoryMi * memScale)),
        dbStorageGi: r.dbStorageGi,
      };
      if (cpuScale < 1 || memScale < 1) await saveAllocation(u.id, r.appName, allocation, r.parts);
      const err = await pushResources(backendFetch, r.appName, allocation, r.parts, pkg.allowDatabase);
      if (err) failed.push(r.appName);
      else updated += 1;
    }
  }
  return { updated, failed };
}

/** Tóm tắt phân bổ của user cho giao diện: tổng gói, đã phân bổ, còn lại, mức từng app */
export async function allocationSummary(user: AuthUser) {
  const pkg = await getEffectivePackage(user);
  const used = await allocatedFor(user.id);
  const projects = await prisma.project.findMany({ where: { userId: user.id }, select: { app_name: true } });
  const rows = await prisma.appAllocation.findMany({
    where: { userId: user.id, appName: { in: projects.map((p) => p.app_name) } },
  });
  return {
    package: packageSummary(pkg),
    total: pkg.unlimited
      ? null
      : { cpuMillicores: pkg.cpuMillicores, memoryMi: pkg.memoryMi, dbStorageGi: pkg.allowDatabase ? pkg.dbStorageGi : 0 },
    allocated: used,
    remaining: await remainingFor(user, pkg),
    usedProjects: projects.length,
    apps: Object.fromEntries(rows.map((r) => [r.appName, { cpuMillicores: r.cpuMillicores, memoryMi: r.memoryMi, dbStorageGi: r.dbStorageGi, parts: r.parts }])),
    presets: RESOURCE_PRESETS,
    minPerPart: { cpuMillicores: MIN_CPU_PER_PART, memoryMi: MIN_MEMORY_PER_PART },
  };
}
