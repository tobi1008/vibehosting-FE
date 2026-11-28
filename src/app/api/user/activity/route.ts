import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/backend';

/** Nhật ký hoạt động của user (admin ?scope=all: của mọi user), mới nhất trước */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const url = new URL(req.url);
  const all = user.role === 'admin' && url.searchParams.get('scope') === 'all';
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get('limit')) || 100));
  const logs = await prisma.activityLog.findMany({
    where: all ? {} : { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { username: true } } },
  });
  const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter(Boolean) as string[]));
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.username]));
  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      action: l.action,
      target: l.target,
      detail: l.detail,
      createdAt: l.createdAt,
      username: l.user.username,
      actor: l.actorId ? actorName.get(l.actorId) || 'admin' : null,
    })),
  );
}
