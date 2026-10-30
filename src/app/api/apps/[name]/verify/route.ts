import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

/** Yêu cầu Hermes Agent kiểm tra lại ứng dụng đang chạy (kết quả đọc qua /health-report) */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const appName = decodeURIComponent((await params).name);
    const access = await requireAppAccess(appName);
    if (access instanceof NextResponse) return access;

    const backendRes = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/verify`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await backendRes.json().catch(() => null);
    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data?.detail || `Lỗi từ máy chủ (${backendRes.status})` },
        { status: backendRes.status }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error triggering health check:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ' }, { status: 500 });
  }
}
