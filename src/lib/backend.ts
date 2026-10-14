import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
  if (user.role === 'admin') return user;

  const takenByOther = await prisma.project.findFirst({
    where: { app_name: appName, NOT: { userId: user.id } },
    select: { id: true },
  });
  if (takenByOther) {
    return NextResponse.json({ error: 'Tên ứng dụng đã được người khác sử dụng' }, { status: 409 });
  }
  return user;
}
