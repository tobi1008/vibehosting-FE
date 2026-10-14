import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';

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
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  try {

    const res = await backendFetch(`/api/ai-providers`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.providers) && data.providers.length > 0) {
        // Ensure claude is always present even if remote VPS backend has not restarted yet
        const hasClaude = data.providers.some((p: { id: string }) => p.id === 'claude');
        if (!hasClaude) {
          const claudeDef = DEFAULT_AI_PROVIDERS.find((p) => p.id === 'claude');
          if (claudeDef) {
            const agyIndex = data.providers.findIndex((p: { id: string }) => p.id === 'agy');
            if (agyIndex !== -1) {
              data.providers.splice(agyIndex + 1, 0, claudeDef);
            } else {
              data.providers.push(claudeDef);
            }
          }
        }
        return NextResponse.json(data);
      }
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
