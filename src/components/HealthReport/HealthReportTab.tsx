'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Stethoscope,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Box,
  Lightbulb,
  FileSearch,
  Clock,
} from 'lucide-react';

interface ContainerState {
  name: string;
  ready: boolean;
  restarts: number;
  state: 'running' | 'waiting' | 'terminated';
  reason?: string;
  message?: string;
  exit_code?: number;
  last_terminated?: { reason?: string; exit_code?: number };
}

interface PodState {
  name: string;
  phase: string;
  containers: ContainerState[];
  conditions: { type: string; status: string; reason?: string; message?: string }[];
}

interface WorkloadState {
  workload: string;
  found: boolean;
  ready: string;
  rollout: string;
  pods: PodState[];
}

export interface HealthReport {
  app_name: string;
  ready: boolean;
  status: 'healthy' | 'starting' | 'pipeline_error' | 'build_error' | 'code_error' | 'k8s_config_error' | 'unknown';
  status_label: string;
  summary: string;
  evidence: string[];
  suggestions: string[];
  analyzed_by: 'hermes' | 'rule-based';
  pipeline_error: string | null;
  workloads: WorkloadState[];
  checked_at: string;
  duration_seconds: number;
}

// Tầng lỗi do Hermes kết luận => cách hiển thị
const STATUS_STYLE: Record<HealthReport['status'], { icon: React.ReactNode; box: string; layer: string }> = {
  healthy: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    box: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    layer: 'Không có lỗi',
  },
  starting: {
    icon: <Clock className="w-5 h-5" />,
    box: 'border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400',
    layer: 'Pod đang khởi động',
  },
  code_error: {
    icon: <XCircle className="w-5 h-5" />,
    box: 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400',
    layer: 'Mã nguồn',
  },
  build_error: {
    icon: <XCircle className="w-5 h-5" />,
    box: 'border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400',
    layer: 'Build image',
  },
  k8s_config_error: {
    icon: <AlertTriangle className="w-5 h-5" />,
    box: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    layer: 'Cấu hình K3s',
  },
  pipeline_error: {
    icon: <AlertTriangle className="w-5 h-5" />,
    box: 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
    layer: 'Pipeline triển khai',
  },
  unknown: {
    icon: <HelpCircle className="w-5 h-5" />,
    box: 'border-border bg-muted/30 text-muted-foreground',
    layer: 'Chưa xác định',
  },
};

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function formatCheckedAt(value: string) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

function containerProblem(c: ContainerState): string | null {
  if (c.state === 'waiting' && c.reason) return c.reason;
  if (c.state === 'terminated') return `${c.reason || 'Terminated'} (exit ${c.exit_code ?? '?'})`;
  if (c.last_terminated?.reason) return `Crash trước: ${c.last_terminated.reason} (exit ${c.last_terminated.exit_code ?? '?'})`;
  return null;
}

export function HealthReportTab({ appName }: { appName: string }) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReport = useCallback(async (): Promise<HealthReport | null> => {
    const res = await fetch(`/api/apps/${encodeURIComponent(appName)}/health-report`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `Lỗi ${res.status}`);
    return data?.status === 'success' ? (data.report as HealthReport) : null;
  }, [appName]);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => {
    let mounted = true;
    fetchReport()
      .then((r) => mounted && setReport(r))
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
      stopPolling();
    };
  }, [fetchReport]);

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    const previousCheck = report?.checked_at;
    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(appName)}/verify`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Lỗi ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setChecking(false);
      return;
    }

    // Hermes chạy nền (chờ rollout + gọi AI), chờ tới khi có báo cáo mới
    const startedAt = Date.now();
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const latest = await fetchReport();
        if (latest && latest.checked_at !== previousCheck) {
          setReport(latest);
          setChecking(false);
          stopPolling();
          return;
        }
      } catch {
        // thử lại ở lần poll sau
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setError('Hermes chưa trả kết quả sau 5 phút. Vui lòng thử lại sau.');
        setChecking(false);
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  };

  const style = report ? STATUS_STYLE[report.status] || STATUS_STYLE.unknown : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Kiểm tra tổng thể (Hermes Agent)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sau mỗi lần Deploy / CI-CD, Hermes đọc trạng thái Pod, sự kiện K3s và log để kết luận ứng dụng chạy ổn định hay lỗi ở mã nguồn / cấu hình K3s. Hermes chỉ quan sát, không tự sửa.
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card hover:bg-muted/60 border border-border text-xs font-medium text-foreground transition-all shadow-xs disabled:opacity-60 shrink-0"
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {checking ? 'Hermes đang kiểm tra...' : 'Kiểm tra lại'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải báo cáo...
        </div>
      ) : !report ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Chưa có báo cáo kiểm tra. Báo cáo được tạo tự động ở cuối mỗi lần triển khai, hoặc bấm “Kiểm tra lại”.
        </div>
      ) : (
        <>
          <div className={`rounded-xl border p-5 flex flex-col gap-3 ${style!.box}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 font-semibold text-base">
                {style!.icon}
                <span>{report.status_label}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-current/30 font-mono">
                Tầng lỗi: {style!.layer}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>Kiểm tra lúc: {formatCheckedAt(report.checked_at)}</span>
              <span>Thời gian: {report.duration_seconds}s</span>
              <span>
                Phân tích bởi: {report.analyzed_by === 'hermes' ? 'Hermes Agent' : 'Luật tự động (Hermes không phản hồi)'}
              </span>
            </div>
          </div>

          {report.pipeline_error && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Lỗi pipeline</h3>
              <pre className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                {report.pipeline_error}
              </pre>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-muted-foreground" /> Bằng chứng
              </h3>
              {report.evidence.length ? (
                <ul className="space-y-1.5">
                  {report.evidence.map((e, i) => (
                    <li key={i} className="text-xs font-mono text-muted-foreground break-words">
                      • {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Không có.</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Gợi ý khắc phục
              </h3>
              {report.suggestions.length ? (
                <ul className="space-y-1.5">
                  {report.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-foreground leading-relaxed">
                      • {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Không cần thao tác thêm.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Box className="w-4 h-4 text-muted-foreground" /> Workload trên K3s
            </h3>
            {report.workloads.length === 0 && <p className="text-xs text-muted-foreground">Không có workload nào.</p>}
            {report.workloads.map((w) => (
              <div key={w.workload} className="rounded-lg border border-border/70 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono text-xs text-foreground">{w.workload}</span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-mono border ${
                      w.found && w.ready.split('/')[0] === w.ready.split('/')[1] && w.ready !== '0/0'
                        ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        : 'border-red-500/30 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {w.found ? `${w.ready} Ready` : w.ready}
                  </span>
                </div>
                {w.pods.map((p) => (
                  <div key={p.name} className="pl-3 border-l border-border flex flex-col gap-1">
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {p.name} · {p.phase}
                    </span>
                    {p.containers.map((c) => {
                      const problem = containerProblem(c);
                      return (
                        <div key={c.name} className="text-[11px] font-mono flex flex-wrap gap-x-3">
                          <span className={c.ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                            {c.ready ? '●' : '○'} {c.name}
                          </span>
                          <span className="text-muted-foreground">restart: {c.restarts}</span>
                          {problem && <span className="text-red-600 dark:text-red-400">{problem}</span>}
                          {c.message && <span className="text-muted-foreground break-all w-full">{c.message}</span>}
                        </div>
                      );
                    })}
                    {p.conditions.map((cond) => (
                      <span key={cond.type} className="text-[11px] text-muted-foreground">
                        {cond.type}: {cond.reason || cond.status} {cond.message}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
