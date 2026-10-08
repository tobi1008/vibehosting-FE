import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const formData = await req.formData();

    const res = await fetch(`${baseUrl}/api/deploy-archive-with-db`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy-archive-with-db:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
