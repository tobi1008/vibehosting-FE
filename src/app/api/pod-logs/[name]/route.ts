import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const resolvedParams = await params;
    const appName = decodeURIComponent(resolvedParams.name);

    if (!appName) {
      return NextResponse.json({ error: 'Thiếu tên ứng dụng' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const lines = searchParams.get('lines') || '200';
    const component = searchParams.get('component');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    let targetUrl = `${baseUrl}/api/pod-logs/${encodeURIComponent(appName)}?lines=${encodeURIComponent(lines)}`;
    if (component && component !== 'all') {
      targetUrl += `&component=${encodeURIComponent(component)}`;
    }

    const res = await fetch(targetUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        data || { status: 'error', logs: `Lỗi từ máy chủ backend (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error proxying pod logs:', err);
    return NextResponse.json(
      { status: 'error', logs: `Lỗi kết nối máy chủ backend: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
