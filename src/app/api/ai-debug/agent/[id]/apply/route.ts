import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';
import { appOwnerId, logActivity } from '@/lib/activity';

/** Người dùng duyệt: Vibe Core ghi các file đã chọn vào mã thật, apply manifest hợp lệ và build lại */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const appName = String(body?.app_name || '');
  const access = await requireAppAccess(appName);
  if (access instanceof NextResponse) return access;
  if (!/^[a-f0-9]{16}$/.test(id)) return NextResponse.json({ error: 'Mã phiên không hợp lệ' }, { status: 400 });
  const paths = Array.isArray(body?.paths) ? body.paths.map(String) : null;
  try {
    const res = await backendFetch(`/api/ai-debug/agent/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_name: appName, paths, rebuild: body?.rebuild !== false }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail || 'Áp dụng thất bại' }, { status: res.status });
    const ok = (data?.results || []).filter((r: { status: string }) => r.status === 'success').length;
    await logActivity({
      userId: (await appOwnerId(appName)) || access.id,
      actorId: access.id,
      action: 'ai_fix',
      target: appName,
      detail: `Áp dụng ${ok} file do AI Agent sửa${data?.rebuild ? ', build lại' : ''}`,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
