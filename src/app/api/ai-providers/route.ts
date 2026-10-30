import { NextResponse } from 'next/server';
import { backendFetch, requireUser } from '@/lib/backend';

export const DEFAULT_AI_PROVIDERS = [
  {
    id: 'agy',
    name: 'Google Antigravity (Gemini Flash)',
    badge: 'Khuyên dùng - Nhanh (5-15s)',
    description: 'Viết cấu hình Nixpacks & K3s bằng CLI trên VPS, tự động dự phòng 3 tầng Gemini 3.8 Flash',
    models: [
      'gemini-3.8-flash-low',
      'gemini-3.8-flash-medium',
      'gemini-3.8-flash-high',
    ],
  },
  {
    id: 'claude',
    name: 'Claude Code (Anthropic Opus/Sonnet)',
    badge: 'Trí tuệ cao cấp (Opus 5.5)',
    description: 'Viết cấu hình Nixpacks & K3s bằng Claude Code CLI trên VPS với Opus 5.5, Sonnet 5.5, Haiku 5.5',
    models: [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
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
        // Hermes không còn viết cấu hình, chỉ là Agent kiểm tra sau triển khai (data.verifier)
        data.providers = data.providers.filter((p: { id: string }) => p.id !== 'hermes');
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
