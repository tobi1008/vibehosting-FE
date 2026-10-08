'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useProjects } from '@/lib/ProjectContext';
import {
  Rocket,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Webhook,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectCicdSettingsProps {
  appName: string;
  onOpenTerminal?: () => void;
  className?: string;
}

export function ProjectCicdSettings({
  appName,
  onOpenTerminal,
  className = '',
}: ProjectCicdSettingsProps) {
  const { updateProjectStatus } = useProjects();
  const [autoCicd, setAutoCicd] = useState<boolean>(false);
  const [hasGithubToken, setHasGithubToken] = useState<boolean>(true);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [updatingConfig, setUpdatingConfig] = useState<boolean>(false);
  const [isRedeploying, setIsRedeploying] = useState<boolean>(false);

  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
    showTerminalLink?: boolean;
  } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
  const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

  const showToast = (
    type: 'success' | 'error',
    message: string,
    showTerminalLink = false
  ) => {
    setToast({ type, message, showTerminalLink });
    setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  const fetchConfig = useCallback(async () => {
    if (!appName) return;
    setLoadingConfig(true);
    try {
      const res = await fetch(`/api/projects/${appName}/cicd`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.auto_cicd === 'boolean') {
          setAutoCicd(data.auto_cicd);
        }
        if (typeof data.hasGithubToken === 'boolean') {
          setHasGithubToken(data.hasGithubToken);
        }
      } else {
        const directRes = await fetch(`/api/apps/${encodeURIComponent(appName)}/config`);
        if (directRes.ok) {
          const directData = await directRes.json();
          const state = directData?.data?.auto_cicd ?? directData?.auto_cicd ?? false;
          setAutoCicd(state);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch CI/CD config for ${appName}:`, err);
    } finally {
      setLoadingConfig(false);
    }
  }, [appName, baseUrl]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleToggleAutoCicd = async () => {
    if (updatingConfig || loadingConfig) return;

    const nextState = !autoCicd;
    setUpdatingConfig(true);

    try {
      const res = await fetch(`/api/projects/${appName}/cicd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_cicd: nextState }),
      });

      const data = await res.json();

      if (res.ok) {
        setAutoCicd(nextState);
        if (typeof data.hasGithubToken === 'boolean') {
          setHasGithubToken(data.hasGithubToken);
        }
        showToast(
          'success',
          data.message ||
            (nextState
              ? `Đã bật Auto Deploy (Webhook) cho "${appName}" thành công!`
              : `Đã tắt Auto Deploy (Webhook) cho "${appName}".`)
        );
      } else {
        showToast(
          'error',
          data.detail || data.message || data.error || 'Không thể cập nhật cấu hình CI/CD'
        );
      }
    } catch (err) {
      showToast('error', 'Lỗi kết nối khi gửi yêu cầu cập nhật Auto CI/CD');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleManualRedeploy = async () => {
    if (isRedeploying) return;

    setIsRedeploying(true);

    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(appName)}/redeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (res.ok && (data.status === 'success' || !data.error)) {
        await updateProjectStatus(appName, 'deploying');
        showToast(
          'success',
          'Đã kích hoạt triển khai phiên bản mới nhất! Vui lòng kiểm tra Terminal để xem tiến trình.',
          Boolean(onOpenTerminal)
        );

        // Keep loading state for 4 seconds then reset button
        setTimeout(() => {
          setIsRedeploying(false);
        }, 4000);
      } else {
        showToast(
          'error',
          data.detail || data.message || 'Không thể kích hoạt Redeploy'
        );
        setIsRedeploying(false);
      }
    } catch (err) {
      showToast('error', 'Lỗi kết nối tới máy chủ khi yêu cầu redeploy');
      setIsRedeploying(false);
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-md ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              )}
              <div className="text-sm">
                <p className="font-medium text-foreground">{toast.message}</p>
                {toast.showTerminalLink && onOpenTerminal && (
                  <button
                    type="button"
                    onClick={onOpenTerminal}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-foreground text-background hover:bg-foreground/90 rounded-md text-xs font-medium transition-all shadow-xs active:scale-95"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Mở Terminal Logs
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature 1: Auto CI/CD Toggle Switch */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-foreground">
                  Auto Deploy (Webhook)
                </h3>
                {loadingConfig ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : autoCicd ? (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                    Bật
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    Tắt
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Tự động kéo mã nguồn mới nhất và triển khai lại ứng dụng mỗi khi có sự kiện Push lên nhánh <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground">main</code> trên GitHub.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            {updatingConfig && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Đang lưu...
              </span>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={autoCicd}
              disabled={loadingConfig || updatingConfig}
              onClick={handleToggleAutoCicd}
              className={`w-14 h-8 rounded-full p-1 transition-colors relative flex items-center outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed ${
                autoCicd ? 'bg-emerald-500' : 'bg-muted-foreground/30'
              }`}
            >
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center ${
                  autoCicd ? 'ml-auto' : 'mr-auto'
                }`}
              >
                {updatingConfig ? (
                  <Loader2 className="w-3 h-3 animate-spin text-foreground" />
                ) : null}
              </motion.div>
            </button>
          </div>
        </div>

        {/* Status Indicator: Fully Automated via GitHub Token */}
        {autoCicd && (
          <div className="mt-5 pt-4 border-t border-border/60">
            {hasGithubToken ? (
              <div className="flex items-center gap-2.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-lg">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  <strong>Đã tự động kết nối Webhook qua GitHub Token:</strong> Mỗi khi bạn <code className="font-mono text-emerald-300">git push</code> lên GitHub, hệ thống sẽ tự động nhận diện và triển khai phiên bản mới nhất mà không cần làm gì thêm.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Chưa kết nối GitHub Token trong tài khoản. Hãy kết nối để hệ thống tự động đồng bộ Webhook.
                  </span>
                </div>
                <Link
                  href="/profile"
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-medium shrink-0 transition-colors"
                >
                  Kết nối ngay
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature 2: Manual Redeploy Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">Manual Deploy</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Bạn có thể tắt Auto CI/CD và sử dụng nút này để chủ động triển khai phiên bản mới nhất (Latest Commit) theo cách thủ công.
              </p>
            </div>
          </div>

          <div className="shrink-0 self-end sm:self-center">
            <button
              type="button"
              disabled={isRedeploying}
              onClick={handleManualRedeploy}
              className="flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 py-2.5 px-5 rounded-lg font-medium text-sm transition-all shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isRedeploying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang triển khai...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Fetch & Deploy Latest Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick hint & Terminal link */}
        <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-foreground/50" />
            Lệnh build sẽ được gửi tới K3s & Nixpacks runner.
          </span>
          {onOpenTerminal && (
            <button
              type="button"
              onClick={onOpenTerminal}
              className="text-foreground hover:underline flex items-center gap-1 font-medium"
            >
              <Terminal className="w-3.5 h-3.5" />
              Xem tiến trình build qua Terminal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
