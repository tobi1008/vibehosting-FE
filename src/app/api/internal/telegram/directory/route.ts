import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Endpoint nội bộ cho Vibe Core (Hermes Butler): danh sách user và app họ sở hữu,
 * để bot Telegram kiểm tra quyền và gửi cảnh báo đúng người.
 * Chỉ Vibe Core gọi được, xác thực bằng header X-API-Key = VIBE_API_KEY.
 * Không trả về mật khẩu, email hay token.
 */
export const dynamic = 'force-dynamic';

function validKey(provided: string | null): boolean {
  const expected = process.env.VIBE_API_KEY || '';
  if (!expected || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!validKey(req.headers.get('x-api-key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const [users, projects] = await Promise.all([
    prisma.user.findMany({ select: { id: true, username: true, role: true } }),
    prisma.project.findMany({ select: { app_name: true, userId: true } }),
  ]);
  return NextResponse.json({ users, projects });
}
