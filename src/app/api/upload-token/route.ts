import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { getBackendBaseUrl, requireAppNameAvailable } from '@/lib/backend';

// Trùng định dạng với create_upload_token trong vibe-core/security.py: <app_name>.<expires_at>.<hmac_hex>
const APP_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
const TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Cấp token upload ngắn hạn để trình duyệt gửi file nén thẳng tới Vibe Core.
 * Không proxy file qua đây vì Vercel giới hạn body của function ở 4,5 MB (lỗi 413).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const appName = String(body?.app_name || '').trim();

  const guard = await requireAppNameAvailable(appName);
  if (guard instanceof NextResponse) return guard;
  if (!APP_NAME_PATTERN.test(appName)) {
    return NextResponse.json({ error: 'Tên ứng dụng không hợp lệ' }, { status: 400 });
  }

  const secret = process.env.VIBE_API_KEY;
  if (!secret) {
    return NextResponse.json({ error: 'Máy chủ chưa cấu hình VIBE_API_KEY' }, { status: 503 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const signature = createHmac('sha256', secret)
    .update(`archive-upload:${appName}:${expiresAt}`)
    .digest('hex');

  return NextResponse.json({
    token: `${appName}.${expiresAt}.${signature}`,
    upload_base_url: getBackendBaseUrl(),
  });
}
