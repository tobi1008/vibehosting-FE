import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { app_name, component = 'be', user_note = '', auto_apply = false, ai_provider } = body;

    const access = await requireAppAccess(String(app_name || ''));
    if (access instanceof NextResponse) return access;

    if (!app_name) {
      return NextResponse.json(
        { error: 'Thiếu tham số app_name' },
        { status: 400 }
      );
    }

    const backendRes = await backendFetch(`/api/ai-debug/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_name,
        component,
        user_note,
        auto_apply,
        ...(ai_provider ? { ai_provider } : {}),
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
