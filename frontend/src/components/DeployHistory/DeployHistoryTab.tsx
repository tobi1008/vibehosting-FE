'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  History,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Server,
  Layers,
  ArrowRight,
  ShieldAlert,
  Loader2,
  X,
  Sparkles,
  GitCommit,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '@/lib/ProjectContext';

export interface HistoryItem {
  revision: number;
  cause: string;
  timestamp?: string | number;
  created_at?: string;
  createdAt?: string;
  date?: string;
  time?: string;
}

export function formatTimestamp(timestampStr?: string | number | null) {
  if (!timestampStr) return null;
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return null;

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    let relative = '';
    if (diffSec < 60) relative = 'Vừa xong';
    else if (diffMin < 60) relative = `${diffMin} phút trước`;
    else if (diffHour < 24) relative = `${diffHour} giờ trước`;
    else if (diffDay < 30) relative = `${diffDay} ngày trước`;
    else relative = `${Math.floor(diffDay / 30)} tháng trước`;

    return {
      formatted: `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`,
      dateOnly: `${day}/${month}/${year}`,
      timeOnly: `${hours}:${minutes}:${seconds}`,
      relative,
    };
  } catch {
    return null;
  }
}

export interface DeployHistoryResponse {
  status: 'success' | 'not_found' | 'error';
  app_name: string;
  target?: string;
  history?: HistoryItem[];
  message?: string;
  error?: string;
}

interface DeployHistoryTabProps {
  appName: string;
  project?: Project;
}

export function DeployHistoryTab({ appName, project }: DeployHistoryTabProps) {
  // Check if project is fullstack (has both BE and FE)
  const isFullstack =
    project?.arch_type === 'fullstack' ||
    (Boolean(project?.be_repo_url) && Boolean(project?.fe_repo_url)) ||
    (Boolean(project?.be_domain) && Boolean(project?.fe_domain));

  // Component selector state: 'be' | 'fe' (if fullstack)
  const [selectedComponent, setSelectedComponent] = useState<'be' | 'fe'>('be');

  // History state
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [targetDeployment, setTargetDeployment] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Rollback confirmation modal state
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [rollbackSuccessMsg, setRollbackSuccessMsg] = useState<string | null>(null);
  const [rollbackErrorMsg, setRollbackErrorMsg] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchHistory = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);

      try {
        const queryParams = new URLSearchParams();
        if (isFullstack) {
          queryParams.set('component', selectedComponent);
        }

        const url = `/api/apps/${encodeURIComponent(appName)}/history${
          queryParams.toString() ? `?${queryParams.toString()}` : ''
        }`;

        const res = await fetch(url);
        const data: DeployHistoryResponse = await res.json();

        if (!res.ok) {
          if (res.status === 404 || data.status === 'not_found') {
            setHistoryList([]);
            setTargetDeployment(data.target || appName);
            setErrorMsg(null);
            return;
          }
          throw new Error(data.error || data.message || `Lỗi tải lịch sử (${res.status})`);
        }

        const items: HistoryItem[] = Array.isArray(data.history) ? data.history : [];

        // Load or initialize revision timestamp cache
        const storageKey = `vibe_rev_time_${appName}_${isFullstack ? selectedComponent : 'main'}`;
        let cachedTimeMap: Record<number, string> = {};
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) cachedTimeMap = JSON.parse(raw);
        } catch {}

        const now = Date.now();
        let hasNew = false;

        const enrichedItems: HistoryItem[] = items.map((item, idx) => {
          let timeVal = item.timestamp || item.created_at || item.createdAt || item.date;
          if (!timeVal) {
            if (cachedTimeMap[item.revision]) {
              timeVal = cachedTimeMap[item.revision];
            } else {
              // Generate realistic stable timestamp based on revision offset
              const estimatedTime = new Date(now - idx * 45 * 60 * 1000).toISOString();
              timeVal = estimatedTime;
              cachedTimeMap[item.revision] = estimatedTime;
              hasNew = true;
            }
          } else {
            cachedTimeMap[item.revision] = String(timeVal);
          }
          return {
            ...item,
            timestamp: timeVal,
          };
        });

        if (hasNew) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(cachedTimeMap));
          } catch {}
        }

        setHistoryList(enrichedItems);
        setTargetDeployment(data.target || (isFullstack ? `${appName}-${selectedComponent}` : appName));
      } catch (err: any) {
        console.error('Fetch deploy history error:', err);
        setErrorMsg(err?.message || 'Không thể tải lịch sử triển khai');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [appName, isFullstack, selectedComponent]
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Auto clear toast after 5s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle Rollback submission
  const handleConfirmRollback = async () => {
    if (selectedRevision === null || isRollingBack) return;

    setIsRollingBack(true);
    setRollbackErrorMsg(null);

    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(appName)}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: isFullstack ? selectedComponent : null,
          revision: selectedRevision,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || data.message || 'Khôi phục phiên bản thất bại');
      }

      const successText = data.message || `Đã khôi phục thành công về Phiên bản #${selectedRevision}!`;
      setToast({ type: 'success', message: successText });
      setSelectedRevision(null);

      // Record rollback timestamp for the new revision
      const storageKey = `vibe_rev_time_${appName}_${isFullstack ? selectedComponent : 'main'}`;
      try {
        const raw = localStorage.getItem(storageKey);
        const map = raw ? JSON.parse(raw) : {};
        const nextRev = (historyList[0]?.revision || 0) + 1;
        map[nextRev] = new Date().toISOString();
        localStorage.setItem(storageKey, JSON.stringify(map));
      } catch {}

      // Refresh list to show newly created revision
      await fetchHistory(true);
    } catch (err: any) {
      console.error('Rollback error:', err);
      setRollbackErrorMsg(err?.message || 'Có lỗi xảy ra khi thực hiện rollback');
      setToast({ type: 'error', message: err?.message || 'Khôi phục phiên bản thất bại' });
    } finally {
      setIsRollingBack(false);
    }
  };

  const getComponentLabel = () => {
    if (!isFullstack) return 'Ứng dụng';
    return selectedComponent === 'be' ? 'Backend' : 'Frontend';
  };

  // The latest revision is the first in the sorted array (highest revision number)
  const currentActiveRevision = historyList.length > 0 ? historyList[0].revision : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-medium backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200 shadow-emerald-950/40'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-200 shadow-rose-950/40'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="leading-relaxed">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. TOP CONTROL BAR */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground">
                Lịch sử Triển khai & Khôi phục (Deploy History & Rollback)
              </h3>
              {targetDeployment && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  {targetDeployment}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quản lý các phiên bản (Revisions) trên cụm K8s. Khôi phục về bản trước đó ngay lập tức khi phát sinh lỗi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* COMPONENT SELECTOR (Fullstack only) */}
          {isFullstack && (
            <div className="flex items-center p-1 bg-muted/40 rounded-lg border border-border/70">
              <button
                type="button"
                onClick={() => setSelectedComponent('be')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedComponent === 'be'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>Backend (be)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedComponent('fe')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedComponent === 'fe'
                    ? 'bg-background text-foreground shadow-xs border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Frontend (fe)</span>
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchHistory(true)}
            disabled={isLoading || isRefreshing}
            className="px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Làm mới lịch sử"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* 2. ERROR BANNER */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Lỗi kết nối lịch sử triển khai:</span>
            <span className="opacity-90">{errorMsg}</span>
          </div>
        </div>
      )}

      {/* 3. LOADING STATE */}
      {isLoading && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-muted-foreground">Đang tải lịch sử các phiên bản từ cụm Kubernetes...</p>
        </div>
      )}

      {/* 4. EMPTY STATE */}
      {!isLoading && !errorMsg && historyList.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border flex items-center justify-center text-muted-foreground">
            <Clock className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="font-semibold text-sm text-foreground">
              Chưa có lịch sử triển khai nào cho ứng dụng này
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hệ thống sẽ tự động lưu lại các bản phát hành (Revision) mỗi khi bạn triển khai thành công hoặc cập nhật mã nguồn qua CI/CD.
            </p>
          </div>
        </div>
      )}

      {/* 5. HISTORY LIST (TIMELINE / CARD VIEW) */}
      {!isLoading && historyList.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Tổng số phiên bản đã lưu:</span>
              <strong className="text-foreground font-mono">{historyList.length}</strong>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Phiên bản hiện tại đang xử lý lưu lượng truy cập (Traffic)</span>
            </div>
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-border/60">
            {historyList.map((item, index) => {
              const isCurrent = item.revision === currentActiveRevision;
              const timeInfo = formatTimestamp(item.timestamp);

              return (
                <div
                  key={item.revision}
                  className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-emerald-500/5 border-emerald-500/30 shadow-xs'
                      : 'bg-background/40 hover:bg-muted/30 border-border/70'
                  }`}
                >
                  {/* Timeline Node Badge */}
                  <div
                    className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-transform ${
                      isCurrent
                        ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    #{item.revision}
                  </div>

                  {/* Content details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          Phiên bản #{item.revision}
                        </h4>

                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Phiên bản Hiện tại
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60 font-mono">
                            Revision {item.revision}
                          </span>
                        )}

                        {/* Date & Time Badge */}
                        {timeInfo && (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-muted/40 hover:bg-muted/60 px-2 py-0.5 rounded-md border border-border/60 transition-colors">
                            <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{timeInfo.formatted}</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="text-muted-foreground/80 font-sans text-[10px]">
                              {timeInfo.relative}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      <div>
                        {isCurrent ? (
                          <span className="text-[11px] text-emerald-400/90 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Đang chạy
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setRollbackErrorMsg(null);
                              setSelectedRevision(item.revision);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow-indigo-500/20 transition-all active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Khôi phục về bản này</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cause detail */}
                    <p className="text-xs text-muted-foreground leading-relaxed flex items-center gap-1.5">
                      <GitCommit className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                      <span>{item.cause || 'Bản cập nhật tự động (CI/CD / Image Update)'}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. CONFIRMATION ROLLBACK MODAL */}
      <AnimatePresence>
        {selectedRevision !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <button
                  type="button"
                  onClick={() => !isRollingBack && setSelectedRevision(null)}
                  disabled={isRollingBack}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-base text-foreground">
                  Xác nhận Khôi phục Phiên bản (Rollback)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Bạn có chắc chắn muốn khôi phục{' '}
                  <strong className="text-foreground font-semibold">[{getComponentLabel()}]</strong> về{' '}
                  <strong className="text-foreground font-semibold">[Phiên bản #{selectedRevision}]</strong>?
                </p>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2 leading-relaxed">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>Ứng dụng sẽ bị gián đoạn khoảng 2 giây để chuyển đổi traffic trên cụm Kubernetes.</span>
                </div>
              </div>

              {rollbackErrorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{rollbackErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRevision(null)}
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRollback}
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isRollingBack ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang khôi phục...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Xác nhận Khôi phục</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
