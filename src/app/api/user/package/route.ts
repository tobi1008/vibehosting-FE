import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/backend';
import { getEffectivePackage, packageSummary } from '@/lib/packages';

/** Gói hosting của user đang đăng nhập và số project đã dùng */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const pkg = await getEffectivePackage(user);
  const used = await prisma.project.count({ where: { userId: user.id } });
  return NextResponse.json({ ...packageSummary(pkg), usedProjects: used });
}
