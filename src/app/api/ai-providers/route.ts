import { NextResponse } from 'next/server';

export const DEFAULT_AI_PROVIDERS = [
  {
    id: 'agy',
    name: 'Google Antigravity (Gemini Flash)',
    badge: 'Khuyên dùng - Nhanh (5-15s)',
    description: 'Thực thi CLI trực tiếp trên VPS, tự động dự phòng 5 tầng Gemini Flash',
    models: [
      'gemini-3.7-flash-high',
      'gemini-3.7-flash-medium',
      'gemini-3.8-flash-low',
      'gemini-3.8-flash-medium',
      'gemini-3.8-flash-high',
    ],
  },
  {
    id: 'claude',
    name: 'Claude Code (Anthropic Opus/Sonnet)',
    badge: 'Trí tuệ cao cấp (Opus 5.5)',
    description: 'Thực thi Claude Code CLI trực tiếp trên VPS với Opus 5.5, Sonnet 5.5, Haiku 5.5',
    models: [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
    ],
  },
  {
    id: 'hermes',
    name: 'Hermes Agent (Open-Source LLMs)',
    badge: 'Mô hình mã nguồn mở',
    description: 'Bộ não suy luận Hermes nguyên bản gọi qua API Gateway nội bộ',
    models: [
      'stepfun/step-3.7-flash:free',
      'poolside/laguna-s-2.1:free',
      'meituan/longcat-2.5-preview:free',
      'openrouter/free',
    ],
  },
];

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const res = await fetch(`${baseUrl}/api/ai-providers`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('Error fetching /api/ai-providers from backend, using fallback:', err);
  }

  // Fallback defaults
  return NextResponse.json({
    status: 'success',
    default: 'agy',
    providers: DEFAULT_AI_PROVIDERS,
  });
}
