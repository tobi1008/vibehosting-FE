import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backendFetch, requireUser } from '@/lib/backend';
import { getEffectivePackage, packageSummary } from '@/lib/packages';

/**
 * Tài nguyên đang dùng của user: CPU, RAM, dung lượng database, ổ tạm của từng app, so với gói hosting.
 * Admin thêm ?scope=all: tổng theo từng user và tài nguyên của các node K3s.
 */

type AppUsage = {
  cpu_m: number;
  memory_mi: number;
  cpu_limit_m: number;
  memory_limit_mi: number;
  ephemeral_mi: number;
  db_used_mi: number | null;
  db_capacity_mi: number;
  pods: { name: string; phase: string; cpu_m: number; memory_mi: number; restarts: number }[];
};

const baseName = (n: string) => n.replace(/-(be|fe|monorepo)$/, '');

function totals(list: AppUsage[]) {
  return list.reduce(
    (t, a) => ({
      cpu_m: t.cpu_m + a.cpu_m,
      memory_mi: t.memory_mi + a.memory_mi,
      cpu_limit_m: t.cpu_limit_m + a.cpu_limit_m,
      memory_limit_mi: t.memory_limit_mi + a.memory_limit_mi,
      ephemeral_mi: t.ephemeral_mi + a.ephemeral_mi,
      db_used_mi: t.db_used_mi + (a.db_used_mi || 0),
      db_capacity_mi: t.db_capacity_mi + a.db_capacity_mi,
    }),
    { cpu_m: 0, memory_mi: 0, cpu_limit_m: 0, memory_limit_mi: 0, ephemeral_mi: 0, db_used_mi: 0, db_capacity_mi: 0 },
  );
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const all = user.role === 'admin' && new URL(req.url).searchParams.get('scope') === 'all';

  const projects = await prisma.project.findMany({
    where: all ? {} : { userId: user.id },
    select: { app_name: true, app_domain: true, status: true, userId: true, user: { select: { username: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  let data: { apps?: Record<string, AppUsage>; nodes?: unknown[]; measured_at?: number } = {};
  let error = '';
  if (projects.length > 0 || all) {
    try {
      const res = await backendFetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: projects.map((p) => p.app_name), include_nodes: all }),
        cache: 'no-store',
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) error = (data as { detail?: string }).detail || 'Không đọc được số liệu từ Vibe Core';
    } catch {
      error = 'Không kết nối được Vibe Core';
    }
  }

  const apps = projects.map((p) => ({
    app_name: p.app_name,
    domain: p.app_domain,
    status: p.status,
    owner: p.user?.username,
    userId: p.userId,
    usage: data.apps?.[baseName(p.app_name)] || null,
  }));
  const mine = apps.filter((a) => a.userId === user.id);
  const pkg = await getEffectivePackage(user);

  const body: Record<string, unknown> = {
    package: { ...packageSummary(pkg), usedProjects: mine.length },
    totals: totals(mine.map((a) => a.usage).filter(Boolean) as AppUsage[]),
    apps: mine,
    measured_at: data.measured_at || null,
    error,
  };

  if (all) {
    const byUser = new Map<string, { username: string; role: string; apps: typeof apps }>();
    for (const a of apps) {
      const entry = byUser.get(a.userId) || { username: a.owner || a.userId, role: '', apps: [] };
      entry.apps.push(a);
      byUser.set(a.userId, entry);
    }
    const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
    body.users = await Promise.all(
      users.map(async (u) => {
        const own = byUser.get(u.id)?.apps || [];
        const p = await getEffectivePackage({ id: u.id, role: u.role });
        return {
          id: u.id,
          username: u.username,
          role: u.role,
          package: packageSummary(p),
          projects: own.length,
          totals: totals(own.map((a) => a.usage).filter(Boolean) as AppUsage[]),
        };
      }),
    );
    body.allApps = apps;
    body.nodes = data.nodes || [];
  }
  return NextResponse.json(body);
}
