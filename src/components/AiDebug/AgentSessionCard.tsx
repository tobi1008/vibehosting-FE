'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, FileCode2, Loader2, ShieldAlert, Wrench } from 'lucide-react';

type Change = {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  kind: 'k8s' | 'code';
  diff: string;
  blocked?: string;
};

type ApplyResult = { path: string; status: string; message?: string; apply?: { status: string; message?: string } };

type Session = {
  id: string;
  status: 'running' | 'done' | 'error';
  engine: string;
  reply: string;
  error: string | null;
  changes: Change[];
  applied: boolean;
  apply_results?: ApplyResult[];
  started_at: number;
};

const STATUS_LABEL: Record<Change['status'], string> = { modified: 'Sửa', added: 'Thêm', deleted: 'Xóa' };

function DiffView({ diff }: { diff: string }) {
  return (
    <pre className="text-[11px] leading-relaxed font-mono bg-background border border-border rounded-md p-2 overflow-x-auto max-h-80">
      {diff.split('\n').map((line, i) => (
        <div
          key={i}
          className={
            line.startsWith('+') && !line.startsWith('+++')
              ? 'text-emerald-600 dark:text-emerald-400'
              : line.startsWith('-') && !line.startsWith('---')
                ? 'text-red-500'
                : line.startsWith('@@')
                  ? 'text-sky-500'
                  : 'text-muted-foreground'
          }
        >
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}

/**
 * Kết quả một phiên AI Debug chế độ Agent: tự hỏi lại trạng thái mỗi 3 giây khi đang chạy, rồi hiện câu trả lời,
 * danh sách file agent đã sửa trên bản sao (kèm diff) để người dùng chọn và bấm "Áp dụng".
 */
export default function AgentSessionCard({
  appName,
  sessionId,
  autoApply = false,
}: {
  appName: string;
  sessionId: string;
  autoApply?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [rebuild, setRebuild] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [now, setNow] = useState(0); // thời điểm lần hỏi trạng thái gần nhất (để hiện số giây đã chạy)
  const autoApplied = useRef(false);

  const apply = useCallback(
    async (paths: string[]) => {
      setApplying(true);
      setApplyError('');
      try {
        const res = await fetch(`/api/ai-debug/agent/${sessionId}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_name: appName, paths, rebuild }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Áp dụng thất bại');
        setSession((s) => (s ? { ...s, applied: true, apply_results: data.results } : s));
      } catch (e) {
        setApplyError((e as Error).message);
      } finally {
        setApplying(false);
      }
    },
    [appName, sessionId, rebuild],
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(`/api/ai-debug/agent/${sessionId}?app_name=${encodeURIComponent(appName)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setError(data?.error || 'Không đọc được phiên agent');
          return;
        }
        const s: Session = data.session;
        setSession(s);
        setNow(Date.now());
        if (s.status === 'running') {
          timer = setTimeout(poll, 3000);
        } else if (s.status === 'done') {
          setSelected(new Set(s.changes.filter((c) => !c.blocked).map((c) => c.path)));
        }
      } catch {
        if (active) timer = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [appName, sessionId]);

  // "Tự áp dụng": áp dụng ngay mọi file hợp lệ khi phiên xong
  useEffect(() => {
    if (!autoApply || autoApplied.current || !session || session.status !== 'done' || session.applied) return;
    const allowed = session.changes.filter((c) => !c.blocked).map((c) => c.path);
    if (allowed.length === 0) return;
    autoApplied.current = true;
    void Promise.resolve().then(() => apply(allowed));
  }, [autoApply, session, apply]);

  if (error) {
    return (
      <div className="text-xs text-red-500 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5" /> {error}
      </div>
    );
  }
  if (!session || session.status === 'running') {
    const elapsed = session && now ? Math.max(0, Math.floor(now / 1000 - session.started_at)) : 0;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        Agent đang đọc mã nguồn, sửa và kiểm tra trên bản sao của app{elapsed ? ` (${elapsed}s)` : ''}… Có thể mất vài phút.
      </div>
    );
  }
  if (session.status === 'error') {
    return (
      <div className="text-xs text-red-500 flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {session.error || 'Phiên agent lỗi'}
      </div>
    );
  }

  const toggle = (set: Set<string>, path: string) => {
    const next = new Set(set);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  };
  const resultFor = (path: string) => session.apply_results?.find((r) => r.path === path);
  const hasCode = session.changes.some((c) => c.kind === 'code' && selected.has(c.path));

  return (
    <div className="space-y-3">
      <div className="whitespace-pre-wrap text-xs leading-relaxed">{session.reply || 'Agent không trả lời gì.'}</div>
      {session.changes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Agent không sửa file nào.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          <div className="px-3 py-2 text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" /> {session.changes.length} file thay đổi trên bản sao (chưa đụng tới app thật)
          </div>
          {session.changes.map((c) => {
            const r = resultFor(c.path);
            return (
              <div key={c.path} className="px-3 py-2 space-y-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    disabled={Boolean(c.blocked) || session.applied}
                    checked={selected.has(c.path)}
                    onChange={() => setSelected((s) => toggle(s, c.path))}
                    aria-label={`Chọn ${c.path}`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen((s) => toggle(s, c.path))}
                    className="flex items-center gap-1 font-mono text-foreground hover:underline min-w-0"
                  >
                    {open.has(c.path) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <FileCode2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.path}</span>
                  </button>
                  <span className="px-1.5 rounded bg-muted text-muted-foreground">{STATUS_LABEL[c.status]}</span>
                  {c.kind === 'k8s' && <span className="px-1.5 rounded bg-sky-500/10 text-sky-500">K3s</span>}
                  {r && (
                    <span className={`ml-auto ${r.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {r.status === 'success' ? 'Đã áp dụng' : 'Bỏ qua'}
                    </span>
                  )}
                </div>
                {c.blocked && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                    <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5" /> Không áp dụng: {c.blocked}
                  </p>
                )}
                {r?.apply && r.apply.status !== 'success' && (
                  <p className="text-[11px] text-red-500">Apply manifest lỗi: {r.apply.message}</p>
                )}
                {open.has(c.path) && c.diff && <DiffView diff={c.diff} />}
              </div>
            );
          })}
          {!session.applied ? (
            <div className="px-3 py-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} />
                Build lại app sau khi ghi mã (cần khi sửa code)
              </label>
              <button
                type="button"
                onClick={() => apply(Array.from(selected))}
                disabled={applying || selected.size === 0}
                className="ml-auto flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
              >
                {applying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Áp dụng {selected.size} file{hasCode && rebuild ? ' và build lại' : ''}
              </button>
            </div>
          ) : (
            <div className="px-3 py-2 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã áp dụng. Xem tiến trình build ở tab Build Logs, trạng thái ở Runtime Logs.
            </div>
          )}
          {applyError && <p className="px-3 py-2 text-[11px] text-red-500">{applyError}</p>}
        </div>
      )}
    </div>
  );
}
