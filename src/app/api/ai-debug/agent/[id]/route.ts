import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

/** Trạng thái phiên agent: đang chạy / xong (kèm câu trả lời và diff các file đã sửa) / lỗi */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appName = new URL(req.url).searchParams.get('app_name') || '';
  const access = await requireAppAccess(appName);
  if (access instanceof NextResponse) return access;
  if (!/^[a-f0-9]{16}$/.test(id)) return NextResponse.json({ error: 'Mã phiên không hợp lệ' }, { status: 400 });
  try {
    const res = await backendFetch(`/api/ai-debug/agent/${id}?app_name=${encodeURIComponent(appName)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({ error: data?.detail || 'Không tìm thấy phiên agent' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Không kết nối được Vibe Core' }, { status: 502 });
  }
}
