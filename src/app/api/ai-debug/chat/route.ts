import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      app_name,
      component = 'be',
      message,
      history = [],
      preferred_model,
      ai_provider,
    } = body;

    const access = await requireAppAccess(String(app_name || ''));
    if (access instanceof NextResponse) return access;

    if (!app_name || !message) {
      return NextResponse.json(
        { error: 'Thiếu tham số app_name hoặc message' },
        { status: 400 }
      );
    }

    const backendRes = await backendFetch(`/api/ai-debug/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_name,
        component,
        message,
        history,
        preferred_model,
        ...(ai_provider ? { ai_provider } : {}),
      }),
    });

    const rawText = await backendRes.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!backendRes.ok) {
      return NextResponse.json(
        {
          error:
            data?.detail ||
            data?.message ||
            data?.error ||
            `Lỗi từ AI DevOps Agent Chat (${backendRes.status})`,
        },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to chat with AI DevOps Agent:', error);
    return NextResponse.json(
      { error: error?.message || 'Không thể kết nối đến dịch vụ AI DevOps Agent Chat' },
      { status: 500 }
    );
  }
}
