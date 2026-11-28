import { NextResponse } from 'next/server';
import { backendFetch, requireAppAccess } from '@/lib/backend';
import { logActivity, appOwnerId } from '@/lib/activity';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const resolvedParams = await params;
    const appName = decodeURIComponent(resolvedParams.name);

    const access = await requireAppAccess(appName);
    if (access instanceof NextResponse) return access;

    if (!appName) {
      return NextResponse.json({ error: 'Thiếu tên ứng dụng' }, { status: 400 });
    }

    const res = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/redeploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json().catch(() => null);
    if (res.ok) {
      await logActivity({ userId: (await appOwnerId(appName)) || access.id, actorId: access.id, action: 'redeploy', target: appName, detail: 'Build lại từ GitHub' });
    }
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying POST app redeploy:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ backend: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
