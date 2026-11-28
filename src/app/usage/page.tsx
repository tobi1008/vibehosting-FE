'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Activity as ActivityIcon,
  AlertCircle,
  Cpu,
  Database,
  FolderGit2,
  Loader2,
  MemoryStick,
  RefreshCw,
  Server,
} from 'lucide-react';
import UsageBar from '@/components/UsageBar';
import { formatCpu, formatMi, timeAgo } from '@/lib/format';

type Totals = {
  cpu_m: number;
  memory_mi: number;
  cpu_limit_m: number;
  memory_limit_mi: number;
  cpu_unlimited?: boolean;
  memory_unlimited?: boolean;
  ephemeral_mi: number;
  db_used_mi: number;
  db_capacity_mi: number;
};

type AppRow = {
  app_name: string;
  domain: string;
  status: string;
  owner?: string;
  usage: (Omit<Totals, 'db_used_mi'> & { db_used_mi: number | null; pods: { name: string; restarts: number }[] }) | null;
};

type PackageInfo = {
  name: string;
  unlimited: boolean;
  maxProjects: number | null;
  cpu: string | null;
  memory: string | null;
  allowDatabase: boolean;
  dbStorage: string | null;
  usedProjects: number;
};

type NodeInfo = {
  name: string;
  cpu_m: number;
  cpu_capacity_m: number;
  memory_mi: number;
  memory_capacity_mi: number;
  disk_used_mi: number;
  disk_capacity_mi: number;
};

type UserRow = { id: string; username: string; role: string; package: { name: string }; projects: number; totals: Totals };

type UsageData = {
  package: PackageInfo;
  totals: Totals;
  apps: AppRow[];
  measured_at: number | null;
  error: string;
  users?: UserRow[];
  allApps?: AppRow[];
  nodes?: NodeInfo[];
};

export default function UsagePage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsage = useCallback(async (s: 'me' | 'all') => {
    const res = await fetch(`/api/user/usage${s === 'all' ? '?scope=all' : ''}`, { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || 'Không tải được số liệu tài nguyên');
    return body as UsageData;
  }, []);

  useEffect(() => {
    let active = true;
    fetchUsage(scope)
      .then((d) => active && (setData(d), setError('')))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [scope, fetchUsage]);

  const refresh = async () => {
    setLoading(true);
    try {
      setData(await fetchUsage(scope));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const pkg = data?.package;
  const t = data?.totals;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ActivityIcon className="w-8 h-8" /> Usage
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tài nguyên các ứng dụng đang dùng so với gói hosting
            {data?.measured_at ? ` · đo ${timeAgo(data.measured_at * 1000)}` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex rounded-lg border border-border p-0.5 text-xs">
              {(['me', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setLoading(true);
                    setScope(s);
                  }}
                  className={`px-3 py-1.5 rounded-md ${scope === s ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
                >
                  {s === 'me' ? 'Của tôi' : 'Toàn hệ thống'}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 border border-border hover:bg-muted px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
      </div>

      {(error || data?.error) && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error || data?.error}
        </div>
      )}

      {!data && loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : data && pkg && t ? (
        <>
          {/* Tổng quan so với gói */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<FolderGit2 className="w-4 h-4" />}
              title="Project"
              value={`${pkg.usedProjects}${pkg.unlimited ? '' : ` / ${pkg.maxProjects}`}`}
              hint={pkg.unlimited ? 'Tài khoản admin: không giới hạn số project' : `Gói ${pkg.name}`}
              used={pkg.usedProjects}
              total={pkg.unlimited ? 0 : pkg.maxProjects || 0}
            />
            <StatCard
              icon={<Cpu className="w-4 h-4" />}
              title="CPU đang dùng"
              value={formatCpu(t.cpu_m)}
              hint={limitHint(t.cpu_unlimited, pkg.unlimited, formatCpu(t.cpu_limit_m), pkg.cpu)}
              used={t.cpu_m}
              total={t.cpu_unlimited ? 0 : t.cpu_limit_m}
            />
            <StatCard
              icon={<MemoryStick className="w-4 h-4" />}
              title="RAM đang dùng"
              value={formatMi(t.memory_mi)}
              hint={limitHint(t.memory_unlimited, pkg.unlimited, formatMi(t.memory_limit_mi), pkg.memory)}
              used={t.memory_mi}
              total={t.memory_unlimited ? 0 : t.memory_limit_mi}
            />
            <StatCard
              icon={<Database className="w-4 h-4" />}
              title="Dung lượng database"
              value={formatMi(t.db_used_mi)}
              hint={
                pkg.allowDatabase
                  ? `Đã cấp ${formatMi(t.db_capacity_mi)}${pkg.dbStorage ? ` · gói ${pkg.dbStorage}/database` : ''}`
                  : 'Gói không bao gồm database'
              }
              used={t.db_used_mi}
              total={t.db_capacity_mi}
            />
          </div>

          <AppTable
            title="Ứng dụng của bạn"
            apps={data.apps}
            empty={
              <>
                Bạn chưa có ứng dụng nào. <Link href="/new" className="underline">Triển khai ứng dụng đầu tiên</Link>.
              </>
            }
          />

          {scope === 'all' && data.nodes && (
            <>
              <h2 className="text-lg font-semibold text-foreground mt-10 mb-3 flex items-center gap-2">
                <Server className="w-5 h-5" /> Node K3s
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.nodes.map((n) => (
                  <div key={n.name} className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <p className="font-mono text-sm font-medium break-all">{n.name}</p>
                    <Meter label="CPU" used={n.cpu_m} total={n.cpu_capacity_m} fmt={formatCpu} />
                    <Meter label="RAM" used={n.memory_mi} total={n.memory_capacity_mi} fmt={formatMi} />
                    <Meter label="Ổ đĩa" used={n.disk_used_mi} total={n.disk_capacity_mi} fmt={formatMi} />
                  </div>
                ))}
              </div>
            </>
          )}

          {scope === 'all' && data.users && (
            <>
              <h2 className="text-lg font-semibold text-foreground mt-10 mb-3">Theo người dùng</h2>
              <div className="bg-card border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[640px]">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Gói</th>
                      <th className="py-3 px-4 text-right">Project</th>
                      <th className="py-3 px-4 text-right">CPU</th>
                      <th className="py-3 px-4 text-right">RAM</th>
                      <th className="py-3 px-4 text-right">Database</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...data.users]
                      .sort((a, b) => b.totals.memory_mi - a.totals.memory_mi)
                      .map((u) => (
                        <tr key={u.id}>
                          <td className="py-3 px-4 font-medium">@{u.username}</td>
                          <td className="py-3 px-4 text-muted-foreground">{u.package.name}</td>
                          <td className="py-3 px-4 text-right">{u.projects}</td>
                          <td className="py-3 px-4 text-right font-mono">{formatCpu(u.totals.cpu_m)}</td>
                          <td className="py-3 px-4 text-right font-mono">{formatMi(u.totals.memory_mi)}</td>
                          <td className="py-3 px-4 text-right font-mono">{formatMi(u.totals.db_used_mi)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {data.allApps && <AppTable title="Mọi ứng dụng" apps={data.allApps} showOwner empty="Chưa có ứng dụng nào." />}
            </>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            CPU/RAM đo tức thời từ kubelet. &quot;Giới hạn đã cấp&quot; là tổng limits của các container đang chạy theo gói. Dung lượng
            database đo trực tiếp trong Pod (cập nhật mỗi 5 phút).
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Dòng chú thích dưới thẻ CPU/RAM: không so với tổng giới hạn khi có app không bị giới hạn */
function limitHint(anyUnlimited: boolean | undefined, adminAccount: boolean, limit: string, perContainer: string | null) {
  if (adminAccount) return 'Tài khoản admin: không giới hạn';
  if (anyUnlimited) return 'Có app chưa được áp giới hạn (sẽ áp ở lần triển khai tới)';
  return `Giới hạn đã cấp: ${limit}${perContainer ? ` · gói ${perContainer}/container` : ''}`;
}

function StatCard({
  icon,
  title,
  value,
  hint,
  used,
  total,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
  used: number;
  total: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-2">
        <span>{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <div className="my-2">
        <UsageBar used={used} total={total} label={title} />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Meter({ label, used, total, fmt }: { label: string; used: number; total: number; fmt: (n: number) => string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="font-mono">
          {fmt(used)} / {fmt(total)}
        </span>
      </div>
      <UsageBar used={used} total={total} label={label} />
    </div>
  );
}

function AppTable({
  title,
  apps,
  showOwner = false,
  empty,
}: {
  title: string;
  apps: AppRow[];
  showOwner?: boolean;
  empty: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-6 text-center">{empty}</p>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[760px]">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Ứng dụng</th>
                <th className="py-3 px-4 w-[20%]">CPU</th>
                <th className="py-3 px-4 w-[20%]">RAM</th>
                <th className="py-3 px-4 w-[18%]">Database</th>
                <th className="py-3 px-4 text-right">Ổ tạm</th>
                <th className="py-3 px-4 text-right">Pod</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apps.map((a) => {
                const u = a.usage;
                const restarts = u?.pods.reduce((s, p) => s + p.restarts, 0) || 0;
                return (
                  <tr key={a.app_name} className="align-top">
                    <td className="py-3 px-4">
                      <Link href={`/project/${encodeURIComponent(a.app_name)}`} className="font-medium hover:underline">
                        {a.app_name}
                      </Link>
                      {showOwner && a.owner && <span className="text-xs text-muted-foreground"> · @{a.owner}</span>}
                      <p className="text-xs text-muted-foreground break-all">{a.domain}</p>
                    </td>
                    {u ? (
                      <>
                        <td className="py-3 px-4">
                          <p className="font-mono text-xs mb-1">
                            {formatCpu(u.cpu_m)} / {u.cpu_limit_m && !u.cpu_unlimited ? formatCpu(u.cpu_limit_m) : 'không giới hạn'}
                          </p>
                          <UsageBar used={u.cpu_m} total={u.cpu_unlimited ? 0 : u.cpu_limit_m} label="CPU" />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-mono text-xs mb-1">
                            {formatMi(u.memory_mi)} / {u.memory_limit_mi && !u.memory_unlimited ? formatMi(u.memory_limit_mi) : 'không giới hạn'}
                          </p>
                          <UsageBar used={u.memory_mi} total={u.memory_unlimited ? 0 : u.memory_limit_mi} label="RAM" />
                        </td>
                        <td className="py-3 px-4">
                          {u.db_capacity_mi ? (
                            <>
                              <p className="font-mono text-xs mb-1">
                                {formatMi(u.db_used_mi)} / {formatMi(u.db_capacity_mi)}
                              </p>
                              <UsageBar used={u.db_used_mi || 0} total={u.db_capacity_mi} label="Database" />
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Không có</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs">{formatMi(u.ephemeral_mi)}</td>
                        <td className="py-3 px-4 text-right text-xs">
                          {u.pods.length}
                          {restarts > 0 && <span className="block text-amber-600 dark:text-amber-400">{restarts} lần restart</span>}
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} className="py-3 px-4 text-xs text-muted-foreground">
                        Chưa có số liệu (app đang triển khai hoặc không chạy)
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
