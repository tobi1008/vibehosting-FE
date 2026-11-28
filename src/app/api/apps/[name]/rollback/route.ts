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
      return NextResponse.json(
        { error: 'Thiếu tên ứng dụng' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { component, revision } = body;

    const backendRes = await backendFetch(`/api/apps/${encodeURIComponent(appName)}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        component: component ?? null,
        revision: typeof revision === 'number' ? revision : Number(revision),
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
          status: 'error',
          error: data?.detail || data?.message || rawText || `Lỗi từ máy chủ (${backendRes.status})`,
        },
        { status: backendRes.status }
      );
    }

    await logActivity({
      userId: (await appOwnerId(appName)) || access.id,
      actorId: access.id,
      action: 'rollback',
      target: appName,
      detail: `Quay về ${Number(revision) ? `revision ${revision}` : 'bản trước'}${component ? ` (${component})` : ''}`,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error executing deploy rollback:', error);
    return NextResponse.json(
      { status: 'error', error: error?.message || 'Lỗi kết nối máy chủ' },
      { status: 500 }
    );
  }
}
