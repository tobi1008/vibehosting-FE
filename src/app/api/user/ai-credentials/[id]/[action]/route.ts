import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';

/** POST /api/user/ai-credentials/<id>/test | /default cho key AI của chính user đang đăng nhập */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id, action } = await params;
  if (!/^[a-f0-9]{8,32}$/.test(id) || !['test', 'default'].includes(action)) {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ' }, { status: 400 });
  }
  try {
    const res = await backendFetch(`/api/ai-credentials/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail || res.statusText }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
