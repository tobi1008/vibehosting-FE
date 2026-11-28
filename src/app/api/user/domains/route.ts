import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { backendFetch, requireUser } from '@/lib/backend';

/** Tên miền của các project của user (admin ?scope=all: mọi project) kèm kết quả kiểm tra HTTPS */
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const all = user.role === 'admin' && new URL(req.url).searchParams.get('scope') === 'all';
  const projects = await prisma.project.findMany({
    where: all ? {} : { userId: user.id },
    select: { app_name: true, app_domain: true, be_domain: true, fe_domain: true, arch_type: true, user: { select: { username: true } } },
    orderBy: { createdAt: 'asc' },
  });

  type Row = { domain: string; app_name: string; kind: string; owner?: string };
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    const entries: [string | null, string][] = [
      [p.app_domain, p.arch_type === 'fullstack' || p.arch_type === 'monorepo' ? 'Frontend' : 'Website'],
      [p.fe_domain, 'Frontend'],
      [p.be_domain, 'Backend API'],
    ];
    for (const [d, kind] of entries) {
      const domain = (d || '').trim().toLowerCase();
      if (domain && !seen.has(domain)) {
        seen.add(domain);
        rows.push({ domain, app_name: p.app_name, kind, owner: all ? p.user?.username : undefined });
      }
    }
  }

  let checks: Record<string, unknown> = {};
  let error = '';
  if (rows.length) {
    try {
      const res = await backendFetch('/api/domains/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: rows.map((r) => r.domain) }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        checks = Object.fromEntries((data.results || []).map((r: { domain: string }) => [r.domain, r]));
      } else {
        error = data?.detail || 'Không kiểm tra được tên miền';
      }
    } catch {
      error = 'Không kết nối được Vibe Core';
    }
  }
  return NextResponse.json({ domains: rows.map((r) => ({ ...r, check: checks[r.domain] || null })), error });
}
