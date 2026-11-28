import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backendFetch, requireAppAccess } from '@/lib/backend';
import {
  allocationSummary,
  getEffectivePackage,
  partsFor,
  pushResources,
  resolveAllocation,
  saveAllocation,
} from '@/lib/packages';
import { logActivity } from '@/lib/activity';

/**
 * Đổi tài nguyên của một project đang chạy (tab Cài đặt): CPU/RAM trong phần còn lại của gói,
 * dung lượng database chỉ tăng được. Áp ngay lên app (Vibe Core kubectl set resources).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const appName = decodeURIComponent((await params).name);
  const access = await requireAppAccess(appName);
  if (access instanceof NextResponse) return access;

  const project = await prisma.project.findFirst({
    where: { app_name: appName },
    select: { userId: true, arch_type: true, db_type: true, fe_domain: true, user: { select: { role: true } } },
  });
  if (!project) return NextResponse.json({ error: 'Không tìm thấy project' }, { status: 404 });

  // Tính theo gói của CHỦ app (admin sửa hộ vẫn phải nằm trong gói của user đó)
  const owner = { id: project.userId, role: project.user.role };
  const pkg = await getEffectivePackage(owner);
  const body = await req.json().catch(() => ({}));
  const resolved = await resolveAllocation(owner, pkg, appName, {
    cpuMillicores: body?.cpu_millicores,
    memoryMi: body?.memory_mi,
    dbStorageGi: body?.db_storage_gi,
    arch: project.arch_type,
    dbType: project.db_type,
    hasFrontend: project.arch_type !== 'monorepo' || Boolean(project.fe_domain),
  });
  if (resolved instanceof NextResponse) return resolved;
  if (!resolved) return NextResponse.json({ error: 'Thiếu mức CPU/RAM' }, { status: 400 });

  const pushed = await pushResources(backendFetch, appName, resolved.allocation, resolved.parts, pkg.allowDatabase);
  if (pushed) return pushed;
  await saveAllocation(owner.id, appName, resolved.allocation, resolved.parts);
  const a = resolved.allocation;
  await logActivity({
    userId: owner.id,
    actorId: access.id,
    action: 'resources',
    target: appName,
    detail: `Đổi tài nguyên: ${a.cpuMillicores}m CPU, ${a.memoryMi} MiB RAM${a.dbStorageGi ? `, database ${a.dbStorageGi} GiB` : ''}`,
  });
  return NextResponse.json({ success: true, allocation: a, parts: resolved.parts });
}

/** Mức tài nguyên hiện tại của project và phần còn lại trong gói của chủ app */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const appName = decodeURIComponent((await params).name);
  const access = await requireAppAccess(appName);
  if (access instanceof NextResponse) return access;
  const project = await prisma.project.findFirst({
    where: { app_name: appName },
    select: { userId: true, arch_type: true, db_type: true, fe_domain: true, user: { select: { role: true } } },
  });
  if (!project) return NextResponse.json({ error: 'Không tìm thấy project' }, { status: 404 });
  const summary = await allocationSummary({ id: project.userId, role: project.user.role });
  return NextResponse.json({
    ...summary,
    current: summary.apps[appName] || null,
    parts: partsFor(project.arch_type, project.db_type, project.arch_type !== 'monorepo' || Boolean(project.fe_domain)),
    hasDatabase: Boolean(project.db_type) && project.db_type !== 'none',
  });
}
