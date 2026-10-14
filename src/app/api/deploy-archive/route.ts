import { NextResponse } from 'next/server';
import { backendFetch, requireAppNameAvailable } from '@/lib/backend';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const guard = await requireAppNameAvailable(String(formData.get('app_name') || '').trim());
    if (guard instanceof NextResponse) return guard;

    const res = await backendFetch(`/api/deploy-archive`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { status: res.statusText }, { status: res.status });
  } catch (err: any) {
    console.error('Error proxying deploy-archive:', err);
    return NextResponse.json(
      { status: 'error', detail: `Lỗi kết nối máy chủ deploy: ${err?.message || err}` },
      { status: 500 }
    );
  }
}
