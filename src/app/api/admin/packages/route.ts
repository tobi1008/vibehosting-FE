import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backendFetch, requireUser } from '@/lib/backend';
import { reapplyForUsers, usersOfPackage } from '@/lib/packages';

/** Admin quản lý gói hosting: GET danh sách, POST tạo, PUT sửa (áp lại giới hạn cho app đang chạy), DELETE xóa */

async function requireAdmin() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin được quản lý gói hosting' }, { status: 403 });
  }
  return user;
}

type PackageInput = {
  name: string;
  description: string | null;
  maxProjects: number;
  cpuMillicores: number;
  memoryMi: number;
  allowDatabase: boolean;
  dbStorageGi: number;
  isDefault: boolean;
};

function intIn(value: unknown, min: number, max: number, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} phải là số nguyên từ ${min} đến ${max}`);
  }
  return n;
}

function parseInput(body: Record<string, unknown>): PackageInput {
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 40) throw new Error('Tên gói dài 2–40 ký tự');
  return {
    name,
    description: body.description ? String(body.description).trim().slice(0, 200) : null,
    maxProjects: intIn(body.maxProjects, 1, 1000, 'Số project'),
    cpuMillicores: intIn(body.cpuMillicores, 50, 64000, 'CPU (millicore)'),
    memoryMi: intIn(body.memoryMi, 64, 262144, 'RAM (MiB)'),
    allowDatabase: Boolean(body.allowDatabase),
    dbStorageGi: intIn(body.dbStorageGi ?? 1, 1, 1024, 'Dung lượng database (GiB)'),
    isDefault: Boolean(body.isDefault),
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const packages = await prisma.package.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json(packages);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  let data: PackageInput;
  try {
    data = parseInput(await req.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (await prisma.package.findUnique({ where: { name: data.name } })) {
    return NextResponse.json({ error: 'Tên gói đã tồn tại' }, { status: 409 });
  }
  const created = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.package.updateMany({ data: { isDefault: false } });
    return tx.package.create({ data });
  });
  // Gói mới là mặc định thì user chưa gán gói chuyển sang giới hạn mới
  const reapplied = data.isDefault
    ? await reapplyForUsers(backendFetch, await usersOfPackage(created.id, true))
    : { updated: 0, failed: [] };
  return NextResponse.json({ package: created, reapplied });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || '');
  const current = id ? await prisma.package.findUnique({ where: { id } }) : null;
  if (!current) return NextResponse.json({ error: 'Không tìm thấy gói' }, { status: 404 });
  let data: PackageInput;
  try {
    data = parseInput(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const clash = await prisma.package.findFirst({ where: { name: data.name, NOT: { id } } });
  if (clash) return NextResponse.json({ error: 'Tên gói đã tồn tại' }, { status: 409 });
  const affectedBefore = await usersOfPackage(id, current.isDefault);
  const updated = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.package.updateMany({ where: { NOT: { id } }, data: { isDefault: false } });
    return tx.package.update({ where: { id }, data });
  });
  const affected = Array.from(new Set([...affectedBefore, ...(await usersOfPackage(id, updated.isDefault))]));
  const reapplied = await reapplyForUsers(backendFetch, affected);
  return NextResponse.json({ package: updated, reapplied });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const id = new URL(req.url).searchParams.get('id') || '';
  const current = id ? await prisma.package.findUnique({ where: { id } }) : null;
  if (!current) return NextResponse.json({ error: 'Không tìm thấy gói' }, { status: 404 });
  const affected = await usersOfPackage(id, current.isDefault);
  await prisma.package.delete({ where: { id } }); // user của gói chuyển về gói mặc định (onDelete: SetNull)
  const reapplied = await reapplyForUsers(backendFetch, affected);
  return NextResponse.json({ success: true, reapplied });
}
