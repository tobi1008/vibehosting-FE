'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Save,
  GitPullRequest,
  RefreshCw,
  AlertTriangle,
  FileX2,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  X,
  Rocket,
} from 'lucide-react';
import { FileTree, isBinaryFile, getFileIcon } from './FileTree';
import { PushToGithubModal, PushSuccessResult } from './PushToGithubModal';
import { FileTreeNode, parseGitHubRepoUrl } from '@/lib/projectFiles';

// Dynamically import Monaco Editor to prevent SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full w-full bg-card/40 text-muted-foreground text-xs gap-3">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <span>Đang tải trình soạn thảo Monaco...</span>
    </div>
  ),
});

interface CodeEditorTabProps {
  appName: string;
  project?: any;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  linkUrl?: string;
  linkText?: string;
}

export function CodeEditorTab({ appName, project }: CodeEditorTabProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // File contents & dirty state
  const [originalContent, setOriginalContent] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [isBinaryFormatError, setIsBinaryFormatError] = useState(false);

  // Pending switch dialog state
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Push to GitHub modal state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [pushSuccessData, setPushSuccessData] = useState<{
    user: string;
    rebuild_triggered?: boolean;
    results: Array<{
      component: string;
      status: string;
      repo_url: string;
      branch: string;
      owner: string;
      message: string;
    }>;
    message: string;
    mainUrl?: string;
  } | null>(null);

  const isFullstack =
    project?.arch_type === 'fullstack' ||
    Boolean(project?.fe_repo_url && project?.be_repo_url) ||
    (tree.some((n) => n.name === 'backend') && tree.some((n) => n.name === 'frontend'));

  const defaultRepoName =
    (project?.be_repo_url && parseGitHubRepoUrl(project.be_repo_url)?.repo) ||
    (project?.repo_url && parseGitHubRepoUrl(project.repo_url)?.repo) ||
    '';

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Fetch File Tree
  const fetchFileTree = useCallback(async () => {
    setIsLoadingTree(true);
    try {
      const res = await fetch(`/api/project/${appName}/files`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tải cấu trúc thư mục');
      }
      const data = await res.json();
      const treeData: FileTreeNode[] = Array.isArray(data) ? data : data.tree || [];
      setTree(treeData);

      // Select first readable file if none selected
      if (!selectedPath && treeData.length > 0) {
        const findFirstFile = (nodes: FileTreeNode[]): string | null => {
          for (const node of nodes) {
            if (node.type === 'file' && !isBinaryFile(node.path)) {
              return node.path;
            }
            if (node.children) {
              const sub = findFirstFile(node.children);
              if (sub) return sub;
            }
          }
          return null;
        };
        const first = findFirstFile(treeData);
        if (first) {
          loadFileContent(first);
        }
      }
    } catch (err: any) {
      console.error('Error fetching file tree:', err);
      addToast({
        type: 'error',
        message: err?.message || 'Lỗi khi tải cây thư mục dự án',
      });
    } finally {
      setIsLoadingTree(false);
    }
  }, [appName, selectedPath, addToast]);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  // 2. Load file content
  const loadFileContent = async (filePath: string) => {
    setSelectedPath(filePath);

    if (isBinaryFile(filePath)) {
      setIsBinaryFormatError(true);
      setOriginalContent('');
      setCurrentContent('');
      return;
    }

    setIsBinaryFormatError(false);
    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/project/${appName}/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 400 || err.is_binary) {
          setIsBinaryFormatError(true);
          return;
        }
        throw new Error(err.error || 'Không thể đọc nội dung file');
      }
      const data = await res.json();
      const content = data.content ?? '';
      setOriginalContent(content);
      setCurrentContent(content);
    } catch (err: any) {
      console.error('Error loading file content:', err);
      addToast({
        type: 'error',
        message: `Lỗi đọc file ${filePath}: ${err?.message}`,
      });
    } finally {
      setIsLoadingFile(false);
    }
  };

  // 3. Handle selecting file from Tree (with unsaved warning)
  const handleSelectFile = (newPath: string) => {
    if (newPath === selectedPath) return;

    // If current file has unsaved edits
    if (selectedPath && dirtyFiles.has(selectedPath) && currentContent !== originalContent) {
      setPendingFilePath(newPath);
      setShowUnsavedWarning(true);
    } else {
      loadFileContent(newPath);
    }
  };

  // 4. Save file changes
  const handleSaveFile = async () => {
    if (!selectedPath || isSaving || isBinaryFile(selectedPath)) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/project/${appName}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedPath,
          content: currentContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lưu file thất bại');
      }

      setOriginalContent(currentContent);
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        next.delete(selectedPath);
        return next;
      });

      addToast({
        type: 'success',
        message: `Đã lưu thay đổi cho ${selectedPath}`,
      });
    } catch (err: any) {
      console.error('Save file error:', err);
      addToast({
        type: 'error',
        message: err?.message || 'Không thể lưu file',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile]);

  // Handle content change in Monaco
  const handleEditorChange = (value: string | undefined) => {
    const newText = value ?? '';
    setCurrentContent(newText);

    if (selectedPath) {
      const isDirty = newText !== originalContent;
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        if (isDirty) {
          next.add(selectedPath);
        } else {
          next.delete(selectedPath);
        }
        return next;
      });
    }
  };

  // Detect language mode for Monaco based on file extension
  const getEditorLanguage = (filePath: string | null): string => {
    if (!filePath) return 'plaintext';
    const lower = filePath.toLowerCase();

    if (lower.endsWith('.ts')) return 'typescript';
    if (lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
    if (lower.endsWith('.html')) return 'html';
    if (lower.endsWith('.md')) return 'markdown';
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml';
    if (lower.endsWith('.sql')) return 'sql';
    if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell';
    if (lower.endsWith('.prisma')) return 'graphql';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.go')) return 'go';
    if (lower.endsWith('.rs')) return 'rust';
    if (lower.endsWith('.xml') || lower.endsWith('.svg')) return 'xml';
    if (lower.startsWith('.env') || lower.endsWith('.ini')) return 'ini';
    if (lower.includes('dockerfile')) return 'dockerfile';

    return 'plaintext';
  };

  const isCurrentFileDirty = Boolean(selectedPath && dirtyFiles.has(selectedPath));

  return (
    <div className="flex flex-col h-[760px] bg-card border border-border rounded-xl shadow-xl overflow-hidden relative">
      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card/90 border-b border-border select-none shrink-0 gap-3">
        {/* Left: Current File Path & Dirty Dot */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedPath ? (
            <div className="flex items-center gap-2 text-xs font-mono text-foreground truncate">
              {getFileIcon(selectedPath)}
              <span className="truncate font-medium">{selectedPath}</span>
              {isCurrentFileDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-rose-500 shadow-xs animate-pulse shrink-0"
                  title="Có thay đổi chưa lưu"
                />
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-mono italic">
              Chưa chọn tập tin nào
            </span>
          )}
        </div>

        {/* Right Actions: Reload, Save, Push to GitHub */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (selectedPath) loadFileContent(selectedPath);
              else fetchFileTree();
            }}
            disabled={isLoadingFile || isLoadingTree}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Tải lại nội dung"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFile || isLoadingTree ? 'animate-spin' : ''}`} />
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveFile}
            disabled={!isCurrentFileDirty || isSaving || isBinaryFile(selectedPath || '')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-xs ${
              isCurrentFileDirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted/50 text-muted-foreground border border-border/50 cursor-not-allowed opacity-60'
            }`}
            title="Lưu file (Ctrl + S / Cmd + S)"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Lưu file</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 text-[10px] font-mono bg-background/20 rounded border border-foreground/10">
              ⌘S
            </kbd>
          </button>

          {/* Push to GitHub Button */}
          <button
            onClick={async () => {
              if (selectedPath && dirtyFiles.has(selectedPath) && !isBinaryFile(selectedPath)) {
                await handleSaveFile();
              }
              setIsPushModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#238636] hover:bg-[#2ea043] text-white transition-all shadow-md active:scale-95 border border-[#2ea043]/30"
            title="Đẩy mã nguồn lên GitHub của bạn"
          >
            <Rocket className="w-3.5 h-3.5 text-white" />
            <span>Push to GitHub</span>
            {dirtyFiles.size > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-black/30 rounded-full">
                {dirtyFiles.size}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* SUCCESS PUSH BANNER */}
      {pushSuccessData && (
        <div className="mx-4 my-2.5 p-4 rounded-xl bg-gradient-to-r from-emerald-950/90 via-[#0d2818]/95 to-emerald-950/90 border border-emerald-500/40 shadow-xl flex items-start justify-between gap-3 shrink-0 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-emerald-200">
                  🎉 Push thành công lên tài khoản GitHub {pushSuccessData.user}!
                </span>
                {pushSuccessData.mainUrl && (
                  <a
                    href={pushSuccessData.mainUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-mono font-medium border border-emerald-500/30 transition-colors"
                  >
                    <span>Mở xem trên GitHub: {pushSuccessData.mainUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {pushSuccessData.rebuild_triggered && (
                <div className="p-2.5 rounded-lg bg-emerald-900/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2 mt-1">
                  <Rocket className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    🚀 Hệ thống đang tự động Rebuild lại Pod từ kho của{' '}
                    <strong className="text-white font-semibold">{pushSuccessData.user}</strong>. Bạn có thể sang tab Pod Logs hoặc Build Logs để xem tiến trình.
                  </span>
                </div>
              )}

              {pushSuccessData.results && pushSuccessData.results.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {pushSuccessData.results.map((res, i) => (
                    <a
                      key={i}
                      href={res.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-emerald-500/25 text-[11px] text-emerald-200 hover:border-emerald-400/50 transition-colors"
                    >
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-400">
                        {res.component || 'repo'}:
                      </span>
                      <span className="truncate max-w-[240px]">{res.repo_url}</span>
                      <ExternalLink className="w-3 h-3 text-emerald-400/70" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setPushSuccessData(null)}
            className="text-emerald-400/70 hover:text-emerald-200 p-1 rounded-md transition-colors"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. MAIN SPLIT VIEW */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: File Explorer (22% - 25%) */}
        <div className="w-64 sm:w-72 md:w-80 shrink-0 h-full">
          <FileTree
            tree={tree}
            selectedPath={selectedPath}
            dirtyFiles={dirtyFiles}
            onSelectFile={handleSelectFile}
            isLoading={isLoadingTree}
          />
        </div>

        {/* Right Column: Code Editor (75% - 78%) */}
        <div className="flex-1 h-full bg-[#1e1e1e] relative overflow-hidden flex flex-col">
          {isLoadingFile ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span>Đang đọc nội dung tập tin {selectedPath}...</span>
            </div>
          ) : !selectedPath ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2 select-none">
              <FileCode2 className="w-10 h-10 opacity-30 text-primary" />
              <span className="font-medium text-foreground">Chọn một tập tin từ cây thư mục</span>
              <span className="text-[11px] opacity-70">
                Bạn có thể xem và chỉnh sửa trực tiếp mã nguồn hoặc file cấu hình
              </span>
            </div>
          ) : isBinaryFile(selectedPath) || isBinaryFormatError ? (
            /* Binary File Notice */
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-6 text-center select-none space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <FileX2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-semibold text-sm text-foreground">
                  Định dạng file không hỗ trợ xem hoặc chỉnh sửa trực tiếp
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Tập tin <code className="text-foreground font-mono">{selectedPath}</code> là định dạng nhị phân hoặc không thể hiển thị dưới dạng văn bản.
                </p>
              </div>
            </div>
          ) : (
            /* Monaco Editor */
            <Editor
              height="100%"
              path={selectedPath}
              language={getEditorLanguage(selectedPath)}
              value={currentContent}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', Menlo, Monaco, 'Courier New', monospace",
                fontLigatures: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
              }}
            />
          )}
        </div>
      </div>

      {/* 3. UNSAVED CHANGES CONFIRMATION DIALOG */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-foreground">
                  Thay đổi chưa được lưu
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bạn có thay đổi chưa lưu trên <code className="font-mono text-foreground font-semibold">{selectedPath}</code>. Bạn có chắc muốn chuyển file?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setPendingFilePath(null);
                }}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  // Discard changes and switch
                  if (pendingFilePath) {
                    if (selectedPath) {
                      setDirtyFiles((prev) => {
                        const next = new Set(prev);
                        next.delete(selectedPath);
                        return next;
                      });
                    }
                    setShowUnsavedWarning(false);
                    const target = pendingFilePath;
                    setPendingFilePath(null);
                    loadFileContent(target);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors"
              >
                Bỏ lưu & Chuyển
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Save changes first then switch
                  await handleSaveFile();
                  setShowUnsavedWarning(false);
                  if (pendingFilePath) {
                    const target = pendingFilePath;
                    setPendingFilePath(null);
                    loadFileContent(target);
                  }
                }}
                className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-xs"
              >
                Lưu & Chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PUSH TO GITHUB MODAL */}
      <PushToGithubModal
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
        appName={appName}
        dirtyCount={dirtyFiles.size}
        isFullstack={isFullstack}
        currentFilePath={selectedPath}
        defaultRepoName={defaultRepoName}
        files={
          selectedPath && currentContent !== undefined && !isBinaryFile(selectedPath)
            ? [{ path: selectedPath.replace(/^\/+/, '').trim(), content: currentContent }]
            : undefined
        }
        onSuccess={(result) => {
          // If current file was dirty, sync with original
          setOriginalContent(currentContent);
          setDirtyFiles(new Set());

          const mainUrl =
            result.results && result.results.length > 0
              ? result.results[0].repo_url
              : (result as any).url || (result as any).repo_url || '';

          setPushSuccessData({
            user: result.user,
            rebuild_triggered: result.rebuild_triggered,
            results: result.results || [],
            message: result.message,
            mainUrl,
          });

          addToast({
            type: 'success',
            message: `🎉 Push thành công lên tài khoản GitHub ${result.user}!`,
            linkUrl: mainUrl,
            linkText: 'Mở xem trên GitHub',
          });

          if (result.rebuild_triggered) {
            setTimeout(() => {
              addToast({
                type: 'info',
                message: `🚀 Hệ thống đang tự động Rebuild lại Pod từ kho của ${result.user}. Bạn có thể sang tab Pod Logs hoặc Build Logs để xem tiến trình.`,
              });
            }, 1000);
          }
        }}
      />

      {/* 5. FLOATING TOAST NOTIFICATIONS */}
      <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3 rounded-lg border shadow-lg flex items-start gap-2.5 text-xs backdrop-blur-md transition-all animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                : 'bg-card/95 border-border text-foreground'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            )}

            <div className="flex-1 space-y-1">
              <p className="font-medium leading-relaxed">{toast.message}</p>
              {toast.linkUrl && (
                <a
                  href={toast.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity text-[11px]"
                >
                  <span>{toast.linkText || 'Mở liên kết'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-70 hover:opacity-100 p-0.5 rounded transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
