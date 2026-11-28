'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  GitBranch,
  History,
  KeyRound,
  Loader2,
  Lock,
  Package,
  Rocket,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Wrench,
} from 'lucide-react';
import { timeAgo } from '@/lib/format';

type Entry = {
  id: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
  username: string;
  actor: string | null;
};

const ACTIONS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  deploy: { label: 'Triển khai', icon: <Rocket className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10' },
  delete: { label: 'Xóa ứng dụng', icon: <Trash2 className="w-4 h-4" />, color: 'text-red-500 bg-red-500/10' },
  redeploy: { label: 'Build lại', icon: <Rocket className="w-4 h-4" />, color: 'text-blue-500 bg-blue-500/10' },
  rollback: { label: 'Rollback', icon: <RotateCcw className="w-4 h-4" />, color: 'text-amber-500 bg-amber-500/10' },
  cicd: { label: 'CI/CD', icon: <GitBranch className="w-4 h-4" />, color: 'text-violet-500 bg-violet-500/10' },
  ai_fix: { label: 'AI Debug', icon: <Wrench className="w-4 h-4" />, color: 'text-emerald-500 bg-emerald-500/10' },
  package: { label: 'Gói hosting', icon: <Package className="w-4 h-4" />, color: 'text-amber-500 bg-amber-500/10' },
  ai_key_added: { label: 'Key AI', icon: <KeyRound className="w-4 h-4" />, color: 'text-violet-500 bg-violet-500/10' },
  ai_key_removed: { label: 'Key AI', icon: <KeyRound className="w-4 h-4" />, color: 'text-muted-foreground bg-muted' },
  password: { label: 'Bảo mật', icon: <Lock className="w-4 h-4" />, color: 'text-muted-foreground bg-muted' },
  resources: { label: 'Tài nguyên', icon: <SlidersHorizontal className="w-4 h-4" />, color: 'text-sky-500 bg-sky-500/10' },
};

function dayLabel(date: string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ActivityPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/user/activity${scope === 'all' ? '?scope=all' : ''}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok) {
          setEntries(body);
          setError('');
        } else setError(body?.error || 'Không tải được nhật ký');
      })
      .catch(() => active && setError('Không tải được nhật ký'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [scope]);

  const groups: { day: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const day = dayLabel(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="w-8 h-8" /> Activity
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Nhật ký triển khai, rollback, CI/CD, sửa lỗi bằng AI và thay đổi tài khoản.
          </p>
        </div>
        {isAdmin && (
          <div className="flex rounded-lg border border-border p-0.5 text-xs self-start">
            {(['me', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setLoading(true);
                  setScope(s);
                }}
                className={`px-3 py-1.5 rounded-md ${scope === s ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
              >
                {s === 'me' ? 'Của tôi' : 'Mọi người dùng'}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-8 text-center">
          <History className="w-6 h-6 mx-auto mb-2" />
          Chưa có hoạt động nào được ghi lại. Nhật ký bắt đầu từ khi tính năng này được bật; lịch sử phiên bản của từng ứng dụng
          vẫn xem được ở tab &quot;Lịch sử&quot; trong trang ứng dụng.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{g.day}</h2>
              <ol className="relative border-l border-border ml-4 space-y-4">
                {g.items.map((e) => {
                  const meta = ACTIONS[e.action] || { label: e.action, icon: <Activity className="w-4 h-4" />, color: 'bg-muted' };
                  return (
                    <li key={e.id} className="ml-6">
                      <span className={`absolute -left-4 flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-background ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="bg-card border border-border rounded-lg px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium text-foreground">{meta.label}</span>
                          {e.target &&
                            (['package', 'ai_key_added', 'ai_key_removed', 'password'].includes(e.action) ? (
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{e.target}</span>
                            ) : (
                              <Link
                                href={`/project/${encodeURIComponent(e.target)}`}
                                className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded hover:underline"
                              >
                                {e.target}
                              </Link>
                            ))}
                          <span className="text-xs text-muted-foreground ml-auto" title={new Date(e.createdAt).toLocaleString('vi-VN')}>
                            {timeAgo(e.createdAt)}
                          </span>
                        </div>
                        {e.detail && <p className="text-xs text-muted-foreground mt-1">{e.detail}</p>}
                        {(scope === 'all' || e.actor) && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {scope === 'all' && <>Tài khoản @{e.username}</>}
                            {e.actor && <>{scope === 'all' ? ' · ' : ''}thực hiện bởi @{e.actor}</>}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
