import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

/** Báo cáo kiểm tra tổng thể gần nhất của Hermes Agent (bước cuối pipeline deploy / CI-CD) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const appName = decodeURIComponent((await params).name);
    const access = await requireAppAccess(appName);
    if (access instanceof NextResponse) return access;

    const backendRes = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/health-report`, {
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
    console.error('Error fetching health report:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi kết nối máy chủ' }, { status: 500 });
  }
}
