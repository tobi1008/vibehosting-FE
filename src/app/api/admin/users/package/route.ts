import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backendFetch, requireUser } from '@/lib/backend';
import { reapplyForUsers } from '@/lib/packages';

/** Admin gán gói cho user (packageId null = dùng gói mặc định), rồi áp lại giới hạn cho các app của user */
export async function PUT(req: Request) {
  const admin = await requireUser();
  if (admin instanceof NextResponse) return admin;
  if (admin.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin được gán gói' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || '');
  const packageId = body?.packageId ? String(body.packageId) : null;
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
  }
  if (packageId && !(await prisma.package.findUnique({ where: { id: packageId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Không tìm thấy gói' }, { status: 404 });
  }
  await prisma.user.update({ where: { id: userId }, data: { packageId } });
  const reapplied = await reapplyForUsers(backendFetch, [userId]);
  return NextResponse.json({ success: true, reapplied });
}
