import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';

/**
 * Admin cấu hình bot Telegram cho Hermes Butler (token do @BotFather cấp).
 * Chỉ admin gọi được; Vibe Core kiểm tra token với Telegram trước khi lưu và không bao giờ trả token về.
 */
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Chỉ admin được cấu hình bot Telegram' }, { status: 403 });
  }
  return user;
}

async function relay(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Vibe Core không phản hồi';
    return NextResponse.json({ error: detail }, { status: res.status });
  }
  return NextResponse.json(data);
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    return await relay(await backendFetch('/api/telegram/config'));
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return NextResponse.json({ error: 'Chưa nhập token' }, { status: 400 });
  try {
    return await relay(
      await backendFetch('/api/telegram/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
    );
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}

export async function DELETE() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    return await relay(await backendFetch('/api/telegram/config', { method: 'DELETE' }));
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
