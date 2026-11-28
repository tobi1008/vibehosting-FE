import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

/** Bắt đầu phiên AI Debug chế độ Agent (agent sửa file trên bản sao mã nguồn trong hộp cát, chạy nền) */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const appName = String(body?.app_name || '');
  const access = await requireAppAccess(appName);
  if (access instanceof NextResponse) return access;
  if (!String(body?.message || '').trim()) {
    return NextResponse.json({ error: 'Thiếu nội dung yêu cầu' }, { status: 400 });
  }
  try {
    const res = await backendFetch('/api/ai-debug/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_name: appName,
        component: body?.component === 'fe' ? 'fe' : 'be',
        message: String(body.message),
        history: Array.isArray(body?.history) ? body.history.slice(-8) : [],
        ai_provider: body?.ai_provider || 'agy',
        user_id: access.id,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail || 'Không bắt đầu được phiên agent' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
