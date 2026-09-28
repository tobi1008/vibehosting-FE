'use client';

import React, { useState, useEffect } from 'react';
import {
  Rocket,
  Key,
  MessageSquare,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
  Eye,
  EyeOff,
  GitBranch,
  FolderGit2,
  Layers,
  CheckSquare2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PushResultItem {
  component: string;
  status: string;
  repo_url: string;
  branch: string;
  owner: string;
  message: string;
}

export interface PushSuccessResult {
  status: string;
  user: string;
  rebuild_triggered?: boolean;
  results: PushResultItem[];
  message: string;
}

interface PushToGithubModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  dirtyCount: number;
  files?: Array<{ path: string; content: string }>;
  isFullstack?: boolean;
  currentFilePath?: string | null;
  defaultRepoName?: string;
  onSuccess: (result: PushSuccessResult) => void;
}

export function PushToGithubModal({
  isOpen,
  onClose,
  appName,
  dirtyCount,
  files,
  isFullstack = false,
  currentFilePath = null,
  defaultRepoName = '',
  onSuccess,
}: PushToGithubModalProps) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [component, setComponent] = useState<'' | 'be' | 'fe'>('');
  const [repoName, setRepoName] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('Update via Vibe Hosting File Manager');
  const [autoRebuild, setAutoRebuild] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize and load saved token & default component on modal open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsLoading(false);
    setShowToken(false);
    setAutoRebuild(true);
    setCommitMessage('Update via Vibe Hosting File Manager');
    setTargetBranch('main');

    // Smart UX: Automatically pre-select 'be' if currently viewing backend/ file, or 'fe' if frontend/ file
    if (isFullstack && currentFilePath) {
      if (currentFilePath.startsWith('backend/')) {
        setComponent('be');
      } else if (currentFilePath.startsWith('frontend/')) {
        setComponent('fe');
      } else {
        setComponent('');
      }
    } else {
      setComponent('');
    }

    try {
      const savedPat =
        localStorage.getItem('github_pat') || localStorage.getItem('vibe_github_pat');
      if (savedPat) {
        setToken(savedPat);
        setHasSavedToken(true);
      }
    } catch (e) {
      // ignore
    }

    // Also try to pre-populate from server profile if available
    const fetchSavedToken = async () => {
      try {
        const res = await fetch('/api/user/github');
        if (res.ok) {
          const data = await res.json();
          if (data.githubToken && !token) {
            setToken(data.githubToken);
            setHasSavedToken(true);
            try {
              localStorage.setItem('github_pat', data.githubToken);
            } catch (e) {}
          }
        }
      } catch (e) {
        // ignore
      }
    };
    fetchSavedToken();
  }, [isOpen, isFullstack, currentFilePath]);

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setErrorMessage('GitHub Personal Access Token (PAT) là bắt buộc');
      return;
    }

    // Save token to localStorage for convenience
    try {
      localStorage.setItem('github_pat', token.trim());
      localStorage.setItem('vibe_github_pat', token.trim());
      setHasSavedToken(true);
    } catch (e) {}

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/project/${appName}/github/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: token.trim(),
          commitMessage: commitMessage.trim() || 'Update via Vibe Hosting File Manager',
          repoName: repoName.trim() || undefined,
          targetBranch: targetBranch.trim() || 'main',
          component: isFullstack ? component : undefined,
          autoRebuild,
          files: files && files.length > 0 ? files : undefined,
        }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!res.ok) {
        const errorDetail =
          data?.error ||
          data?.message ||
          data?.detail ||
          (res.status === 401
            ? "Token không hợp lệ hoặc thiếu quyền 'repo'"
            : `Đẩy mã nguồn thất bại (HTTP ${res.status}): ${rawText.slice(0, 150)}`);
        throw new Error(errorDetail);
      }

      if (!data) {
        throw new Error('Phản hồi từ máy chủ không hợp lệ');
      }

      // Success: Close modal & notify parent
      setIsLoading(false);
      onClose();
      onSuccess(data);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(
        err?.message ||
          'Đẩy mã nguồn thất bại. Vui lòng kiểm tra lại quyền hạn của GitHub Token hoặc kết nối mạng.'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#238636]/15 border border-[#238636]/30 flex items-center justify-center text-[#2ea043]">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">
                Đẩy mã nguồn lên GitHub của bạn
              </h3>
              <p className="text-xs text-muted-foreground">
                Tự động tạo repository cá nhân, chuyển nhánh sang main và cập nhật remote origin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <form onSubmit={handlePush} className="space-y-4">
            {/* 1. GitHub PAT (Bắt buộc) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>GitHub Personal Access Token (PAT)</span>
                  <span className="text-rose-400">*</span>
                </label>
                {hasSavedToken && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Đã lưu trên trình duyệt
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-background border border-border rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  tabIndex={-1}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors p-1"
                  title={showToken ? 'Ẩn token' : 'Hiện token'}
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Token của bất kỳ tài khoản GitHub nào có quyền <code className="text-foreground font-mono font-semibold">repo</code> (tự động nhận diện chủ sở hữu token).
              </p>
            </div>

            {/* 2. Chọn Component cần Push (Nếu dự án Fullstack 2-repo) */}
            {isFullstack && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Chọn Component cần Push (Dự án Fullstack)</span>
                  </label>
                  {currentFilePath && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      File đang xem: {currentFilePath.startsWith('backend/') ? 'Backend' : currentFilePath.startsWith('frontend/') ? 'Frontend' : 'Chung'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setComponent('')}
                    disabled={isLoading}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      component === ''
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-xs ring-1 ring-primary/30'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    Cả hai (BE & FE)
                  </button>
                  <button
                    type="button"
                    onClick={() => setComponent('be')}
                    disabled={isLoading}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      component === 'be'
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-xs ring-1 ring-primary/30'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    Chỉ Backend (be)
                  </button>
                  <button
                    type="button"
                    onClick={() => setComponent('fe')}
                    disabled={isLoading}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                      component === 'fe'
                        ? 'bg-primary/15 border-primary text-primary font-semibold shadow-xs ring-1 ring-primary/30'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    Chỉ Frontend (fe)
                  </button>
                </div>
              </div>
            )}

            {/* 3. Tên Repository mong muốn trên GitHub (Tùy chọn) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Tên Repository mong muốn (Tùy chọn)</span>
              </label>
              <input
                type="text"
                placeholder="Để trống để giữ nguyên tên repo hiện tại"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={isLoading}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
              />
              <p className="text-[11px] text-muted-foreground">
                Nếu repo chưa có trên GitHub của bạn, hệ thống sẽ tự động tạo repo mới.
              </p>
            </div>

            {/* 4. Nhánh mục tiêu & Nội dung Commit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Target Branch */}
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Nhánh mục tiêu</span>
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
                  required
                />
              </div>

              {/* Commit Message */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Nội dung Commit</span>
                </label>
                <input
                  type="text"
                  placeholder="Update via Vibe Hosting File Manager"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* 5. Checkbox Tự động Rebuild (Rất quan trọng) */}
            <label
              htmlFor="auto-rebuild-check"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/80 cursor-pointer select-none hover:bg-muted/60 transition-colors"
            >
              <input
                id="auto-rebuild-check"
                type="checkbox"
                checked={autoRebuild}
                onChange={(e) => setAutoRebuild(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/50 accent-primary cursor-pointer"
              />
              <div className="flex-1 space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  Tự động Rebuild và cập nhật Pod sau khi push thành công
                </span>
                <span className="text-[11px] text-muted-foreground block leading-relaxed">
                  Hệ thống sẽ đồng bộ remote và khởi chạy quy trình build tự động ngay trên Kubernetes để áp dụng thay đổi code mới nhất.
                </span>
              </div>
            </label>

            {/* Loading Indicator Banner */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-primary/10 border border-primary/25 rounded-lg flex items-center gap-3 text-xs"
                >
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      Đang xử lý đẩy mã nguồn lên GitHub...
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Hệ thống đang đồng bộ git tree, tạo repo (nếu cần), đổi nhánh và cập nhật remote origin trên VPS.
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message Alert (Keep modal open, show red alert) */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-lg flex items-start gap-2.5 text-xs text-rose-400 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <span className="font-semibold block text-rose-300">Lỗi đẩy mã nguồn:</span>
                  <span className="opacity-95 leading-relaxed block">{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {dirtyCount > 0 ? (
                  <span className="text-amber-400 font-medium">
                    {dirtyCount} file có thay đổi sẽ được commit và đẩy
                  </span>
                ) : (
                  <span>Tất cả file đã sẵn sàng</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white font-semibold text-xs rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5" />
                      <span>Xác nhận Push ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
