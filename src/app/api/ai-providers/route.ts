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
      'gemini-2.5-flash',
      'gemini-2.0-flash',
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
      'meta-llama/llama-3.3-70b-instruct:free',
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
