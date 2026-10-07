import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { app_name, component = 'be', user_note = '', auto_apply = false } = body;

    if (!app_name) {
      return NextResponse.json(
        { error: 'Thiếu tham số app_name' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const backendRes = await fetch(`${baseUrl}/api/ai-debug/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_name,
        component,
        user_note,
        auto_apply,
      }),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || 'Lỗi khi phân tích từ AI DevOps Agent' },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to analyze with AI Debug:', error);
    return NextResponse.json(
      { error: error?.message || 'Không thể kết nối đến dịch vụ AI DevOps Agent' },
      { status: 500 }
    );
  }
}
