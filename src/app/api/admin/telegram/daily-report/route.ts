import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';

/** Admin gửi thử ngay báo cáo hằng ngày của Hermes tới Telegram của chính mình */
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin được gửi thử báo cáo' }, { status: 403 });
  }
  try {
    const res = await backendFetch('/api/telegram/daily-report/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : 'Vibe Core không phản hồi';
      return NextResponse.json({ error: detail }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
