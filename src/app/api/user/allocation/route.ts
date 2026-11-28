import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/backend';
import { allocationSummary } from '@/lib/packages';

/** Tổng tài nguyên của gói, phần đã phân bổ cho các app, phần còn lại và các mức có sẵn (trang tạo project) */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await allocationSummary(user));
}
