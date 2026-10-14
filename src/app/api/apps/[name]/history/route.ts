import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const resolvedParams = await params;
    const appName = decodeURIComponent(resolvedParams.name);

    const access = await requireAppAccess(appName);
    if (access instanceof NextResponse) return access;

    if (!appName) {
      return NextResponse.json(
        { error: 'Thiếu tên ứng dụng' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const component = searchParams.get('component');

    let targetUrl = `/api/apps/${encodeURIComponent(appName)}/history`;
    if (component) {
      targetUrl += `?component=${encodeURIComponent(component)}`;
    }

    const backendRes = await backendFetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    const rawText = await backendRes.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!backendRes.ok) {
      if (backendRes.status === 404) {
        return NextResponse.json(
          {
            status: 'not_found',
            app_name: appName,
            target: component ? `${appName}-${component}` : appName,
            history: [],
            message: data?.detail || 'Chưa có lịch sử triển khai nào cho ứng dụng này.',
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: data?.detail || data?.message || rawText || `Lỗi từ máy chủ (${backendRes.status})`,
        },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching deploy history:', error);
    return NextResponse.json(
      { error: error?.message || 'Lỗi kết nối máy chủ' },
      { status: 500 }
    );
  }
}
