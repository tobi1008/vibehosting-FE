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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const targetUrl = `${baseUrl}/api/logs/${encodeURIComponent(appName)}`;

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
    console.error('Error proxying build logs:', err);
    return NextResponse.json(
      { status: 'error', logs: `Lỗi kết nối máy chủ backend: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
