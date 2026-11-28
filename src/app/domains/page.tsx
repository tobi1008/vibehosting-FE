'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, ExternalLink, Globe, Loader2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

type Check = {
  ok: boolean;
  status_code?: number;
  error?: string;
  response_ms: number;
  cert_days_left: number | null;
};

type DomainRow = { domain: string; app_name: string; kind: string; owner?: string; check: Check | null };

function StatusBadge({ check }: { check: Check | null }) {
  if (!check) return <span className="text-xs text-muted-foreground">Chưa kiểm tra</span>;
  if (check.error || !check.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
        <XCircle className="w-3.5 h-3.5" /> {check.status_code ? `HTTP ${check.status_code}` : check.error || 'Lỗi'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" /> HTTP {check.status_code}
    </span>
  );
}

function CertBadge({ days }: { days: number | null | undefined }) {
  if (days === null || days === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500">
        <ShieldAlert className="w-3.5 h-3.5" /> Không đọc được
      </span>
    );
  }
  const color = days < 7 ? 'text-red-500' : days < 14 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
  return <span className={`text-xs font-medium ${color}`}>Còn {Math.floor(days)} ngày</span>;
}

export default function DomainsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDomains = useCallback(async (s: 'me' | 'all') => {
    const res = await fetch(`/api/user/domains${s === 'all' ? '?scope=all' : ''}`, { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || 'Không tải được tên miền');
    return body as { domains: DomainRow[]; error: string };
  }, []);

  useEffect(() => {
    let active = true;
    fetchDomains(scope)
      .then((d) => active && (setRows(d.domains), setError(d.error)))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [scope, fetchDomains]);

  const refresh = async () => {
    setLoading(true);
    try {
      const d = await fetchDomains(scope);
      setRows(d.domains);
      setError(d.error);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const healthy = rows.filter((r) => r.check?.ok).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Globe className="w-8 h-8" /> Domains
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tên miền của các ứng dụng, tình trạng HTTPS và hạn chứng chỉ SSL.
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
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Kiểm tra lại
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" /> Đang gọi thử từng tên miền…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-8 text-center">
          Chưa có tên miền nào. Tên miền được gắn khi bạn <Link href="/new" className="underline">triển khai ứng dụng</Link>.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {healthy}/{rows.length} tên miền đang hoạt động.
          </p>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[720px]">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tên miền</th>
                  <th className="py-3 px-4">Ứng dụng</th>
                  <th className="py-3 px-4">HTTPS</th>
                  <th className="py-3 px-4 text-right">Phản hồi</th>
                  <th className="py-3 px-4">Chứng chỉ SSL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.domain}>
                    <td className="py-3 px-4">
                      <a
                        href={`https://${r.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs inline-flex items-center gap-1 hover:underline break-all"
                      >
                        {r.domain} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <p className="text-[11px] text-muted-foreground">{r.kind}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/project/${encodeURIComponent(r.app_name)}`} className="hover:underline">
                        {r.app_name}
                      </Link>
                      {r.owner && <span className="text-xs text-muted-foreground"> · @{r.owner}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge check={r.check} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">{r.check ? `${r.check.response_ms} ms` : '—'}</td>
                    <td className="py-3 px-4">
                      {r.check ? <CertBadge days={r.check.cert_days_left} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Chứng chỉ do cert-manager cấp qua Let&apos;s Encrypt và tự gia hạn trước khi hết hạn. Hermes trên Telegram nhắn bạn
            khi chứng chỉ còn dưới 14 ngày hoặc tên miền không truy cập được.
          </p>
        </>
      )}
    </div>
  );
}
