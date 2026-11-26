import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';
import { prisma } from '@/lib/prisma';

/**
 * Liên kết Telegram với Hermes Butler.
 * user_id luôn lấy từ phiên đăng nhập phía server, trình duyệt không gửi được user_id của người khác.
 */
export const dynamic = 'force-dynamic';

async function relay(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data.detail || 'Vibe Core không phản hồi' }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return await relay(await backendFetch(`/api/telegram/status?user_id=${encodeURIComponent(user.id)}`));
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}

export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } });
  try {
    return await relay(
      await backendFetch('/api/telegram/link-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, username: profile?.username || '' }),
      }),
    );
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return await relay(
      await backendFetch(`/api/telegram/link?user_id=${encodeURIComponent(user.id)}`, { method: 'DELETE' }),
    );
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
