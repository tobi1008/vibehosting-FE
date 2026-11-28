import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';
import { logActivity } from '@/lib/activity';

/**
 * Key AI riêng của user đang đăng nhập. Proxy tới Vibe Core, luôn gắn user_id của phiên (không lấy từ body),
 * nên user chỉ xem/sửa được key của chính mình. Vibe Core không bao giờ trả API key về.
 */

async function relay(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ error: data?.detail || data?.error || res.statusText }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    return relay(await backendFetch(`/api/ai-credentials?user_id=${encodeURIComponent(user.id)}`, { cache: 'no-store' }));
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => ({}));
  const payload = {
    user_id: user.id,
    id: body?.id || undefined,
    provider: String(body?.provider || ''),
    model: String(body?.model || ''),
    api_key: body?.api_key ? String(body.api_key) : undefined,
    base_url: body?.base_url ? String(body.base_url) : undefined,
    label: body?.label ? String(body.label) : undefined,
    is_default: Boolean(body?.is_default),
  };
  try {
    const res = await backendFetch('/api/ai-credentials', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await logActivity({
        userId: user.id,
        action: 'ai_key_added',
        target: payload.provider,
        detail: `${payload.id ? 'Cập nhật' : 'Thêm'} key AI, model ${payload.model}`,
      });
    }
    return relay(res);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{8,32}$/.test(id)) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 });
  try {
    const res = await backendFetch(`/api/ai-credentials/${id}?user_id=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    if (res.ok) await logActivity({ userId: user.id, action: 'ai_key_removed', detail: 'Xóa key AI' });
    return relay(res);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
