import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/backend';
import { logActivity } from '@/lib/activity';

/** User tự đổi mật khẩu: phải nhập đúng mật khẩu hiện tại */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => ({}));
  const current = String(body?.currentPassword || '');
  const next = String(body?.newPassword || '');
  if (next.length < 8) {
    return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'Mật khẩu mới phải khác mật khẩu hiện tại' }, { status: 400 });
  }
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });
  if (!record || !(await bcrypt.compare(current, record.password))) {
    return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 403 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10) } });
  await logActivity({ userId: user.id, action: 'password', detail: 'Đổi mật khẩu' });
  return NextResponse.json({ success: true });
}
