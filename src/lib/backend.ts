import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEffectivePackage, pushResources, requireProjectQuota } from '@/lib/packages';

/**
 * Kết nối tới Vibe Core API (backend) — CHỈ dùng trong API route phía server.
 * VIBE_API_KEY không có tiền tố NEXT_PUBLIC_ nên không bao giờ bị đóng gói vào code trình duyệt.
 */
export function getBackendBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
  return apiUrl.replace(/\/api\/deploy\/?$/, '');
}

export function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-API-Key', process.env.VIBE_API_KEY || '');
  return fetch(`${getBackendBaseUrl()}${path}`, { ...init, headers });
}

export type AuthUser = { id: string; role: string };

/** Trả về user đang đăng nhập, hoặc NextResponse 401 nếu chưa đăng nhập */
export async function requireUser(): Promise<AuthUser | NextResponse> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { id: sessionUser.id, role: sessionUser.role || 'user' };
}

/** Tên gốc của app: bỏ hậu tố component (-be, -fe, -monorepo) mà backend tự thêm */
function baseAppName(appName: string): string {
  return appName.replace(/-(be|fe|monorepo)$/, '');
}

/**
 * Yêu cầu user đang đăng nhập là chủ sở hữu app (hoặc admin).
 * Trả về NextResponse 401/403 nếu không có quyền.
 */
export async function requireAppAccess(appName: string): Promise<AuthUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role === 'admin') return user;

  const candidates = Array.from(new Set([appName, baseAppName(appName)]));
  const owned = await prisma.project.findFirst({
    where: { userId: user.id, app_name: { in: candidates } },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập ứng dụng này' }, { status: 403 });
  }
  return user;
}

/**
 * Dùng cho các route deploy: tên app chưa thuộc về user khác.
 * Cho phép deploy lại app của chính mình.
 */
export async function requireAppNameAvailable(appName: string): Promise<AuthUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!appName) {
    return NextResponse.json({ error: 'Thiếu tên ứng dụng' }, { status: 400 });
  }
  if (user.role === 'admin') return registerAppOwner(appName, user);

  const takenByOther = await prisma.project.findFirst({
    where: { app_name: appName, NOT: { userId: user.id } },
    select: { id: true },
  });
  if (takenByOther) {
    return NextResponse.json({ error: 'Tên ứng dụng đã được người khác sử dụng' }, { status: 409 });
  }

  // Gói hosting: chặn khi hết số project, rồi gửi giới hạn CPU/RAM/database cho Vibe Core trước khi triển khai
  const pkg = await getEffectivePackage(user);
  const quota = await requireProjectQuota(user, appName, pkg);
  if (quota) return quota;
  const pushed = await pushResources(backendFetch, appName, pkg);
  if (pushed) return pushed;
  return registerAppOwner(appName, user);
}

/**
 * Báo Vibe Core ai là chủ app trước khi triển khai: key AI riêng ("byo:<id>") chỉ dùng được cho app
 * khi key thuộc đúng chủ này (luồng upload file nén gọi thẳng Vibe Core nên không tin user_id từ trình duyệt).
 */
async function registerAppOwner(appName: string, user: AuthUser): Promise<AuthUser | NextResponse> {
  try {
    const res = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return NextResponse.json({ error: `Không đăng ký được chủ ứng dụng: ${data?.detail || res.statusText}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: `Không kết nối được Vibe Core: ${(e as Error).message}` }, { status: 502 });
  }
  return user;
}
