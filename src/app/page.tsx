"use client";

import Link from "next/link";
import { useProjects, Project } from "@/lib/ProjectContext";
import { Plus, GitBranch, ExternalLink, Activity, Clock, Loader2, AlertCircle, Trash2, Terminal, X, Sliders, Cpu, Box, FolderArchive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ProjectCicdSettings } from "@/components/ProjectCicdSettings";
import { extractCurrentSessionLines } from "@/lib/deployment";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { projects, removeProject } = useProjects();
  
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);
  const [logViewerProject, setLogViewerProject] = useState<Project | null>(null);
  const [modalLogTab, setModalLogTab] = useState<'runtime' | 'build'>('runtime');
  const [podName, setPodName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Polling for logs (both View and Delete modes)
  useEffect(() => {
    if (!logViewerProject || isDeleting) {
      if (!logViewerProject) {
        setLogs([]);
        setPodName(null);
      }
      return;
    }

    const fetchLogs = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://116.118.50.199:8080/api/deploy";
        const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, "");

        if (modalLogTab === 'runtime') {
          // Fetch Pod Runtime Logs
          const res = await fetch(`/api/pod-logs/${encodeURIComponent(logViewerProject.app_name)}?lines=200`);
          if (!res.ok) return false;
          const data = await res.json();
          if (data.status === 'success') {
            setPodName(data.pod_name || null);
            setLogs(data.logs ? data.logs.split('\n') : []);
          } else if (data.status === 'warning') {
            setPodName(null);
            setLogs([`> ⚠️ ${data.logs || 'Chưa tìm thấy Pod đang chạy cho ứng dụng này.'}`]);
          }
          return false;
        }

        // Fetch Build Logs
        const res = await fetch(`/api/logs/${encodeURIComponent(logViewerProject.app_name)}`);
        if (!res.ok) return false;
        const data = await res.json();
        
        if (data.logs) {
          const { sessionLines } = extractCurrentSessionLines(data.logs);
          const displayLines = sessionLines.length > 500 ? sessionLines.slice(-500) : sessionLines;
          setLogs(displayLines.map((l: string) => `> ${l}`));
        }
      } catch (err) {
        console.error("Fetch logs error", err);
      }
      return false;
    };

    fetchLogs();
    const interval = setInterval(async () => {
      await fetchLogs();
    }, 2500);

    return () => clearInterval(interval);
  }, [logViewerProject, isDeleting, modalLogTab]);

  const handleDelete = async () => {
    if (!deleteConfirmProject) return;
    const project = deleteConfirmProject;
    setDeleteConfirmProject(null);
    
    setIsDeleting(true);
    setLogViewerProject(project);
    setLogs([
      `> 🗑️ Bắt đầu tiến trình xóa dự án: ${project.app_name}...`,
      `> ⏳ Đang gửi yêu cầu dọn dẹp tài nguyên (K8s Pods, Services, Workspaces) tới máy chủ...`
    ]);

    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(project.app_name)}`, {
        method: 'DELETE',
      });
      
      const data = await response.json().catch(() => null);
      if (response.ok && (data?.status === 'success' || response.status === 200)) {
        setLogs(prev => [
          ...prev,
          `> ✅ Máy chủ: ${data?.message || "Đã dọn dẹp sạch toàn bộ tài nguyên trên cụm K8s."}`,
          `> 💾 Đang xóa dự án khỏi cơ sở dữ liệu hệ thống...`
        ]);

        await removeProject(project.id);

        setLogs(prev => [
          ...prev,
          `> ✅ Dự án '${project.app_name}' đã được xóa hoàn tất!`
        ]);

        setTimeout(() => {
          setLogViewerProject(null);
          setIsDeleting(false);
        }, 1500);
      } else if (response.status === 404) {
        // Already cleaned up on the remote cluster
        setLogs(prev => [
          ...prev,
          `> ℹ️ Tài nguyên trên máy chủ đã được dọn dẹp trước đó.`,
          `> 💾 Đang xóa dự án khỏi cơ sở dữ liệu hệ thống...`
        ]);

        await removeProject(project.id);

        setLogs(prev => [
          ...prev,
          `> ✅ Dự án '${project.app_name}' đã được xóa hoàn tất!`
        ]);

        setTimeout(() => {
          setLogViewerProject(null);
          setIsDeleting(false);
        }, 1500);
      } else {
        const errorMsg = data?.detail || data?.message || `Lỗi (${response.status}): Không thể thực hiện xóa`;
        setLogs(prev => [
          ...prev,
          `> ❌ Lỗi khi xóa trên máy chủ: ${errorMsg}`,
          `> Bạn có thể đóng cửa sổ này và kiểm tra lại.`
        ]);
        setIsDeleting(false);
      }
    } catch (error: any) {
      console.error('Lỗi khi xóa:', error);
      setLogs(prev => [
        ...prev,
        `> ❌ Thất bại: ${error?.message || "Lỗi mạng hoặc kết nối"}`,
        `> Bạn có thể đóng cửa sổ này và kiểm tra lại.`
      ]);
      setIsDeleting(false);
    }
  };

  const closeLogViewer = () => {
    if (isDeleting) return; // Prevent closing while deleting
    setLogViewerProject(null);
  };

  const openLogViewer = (project: Project) => {
    setModalLogTab(project.status === 'active' ? 'runtime' : 'build');
    setLogViewerProject(project);
  };

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage and deploy your web applications.</p>
        </div>
        <Link
          href="/new"
          className="inline-flex items-center justify-center gap-2 bg-foreground text-background px-4 py-2 rounded-md font-medium text-sm transition-all hover:bg-foreground/90 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New...
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center bg-card/30">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            You haven't deployed any projects yet. Create your first project to get started.
          </p>
          <Link
            href="/new"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm transition-all hover:opacity-90"
          >
            Deploy Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group border border-border bg-card rounded-xl p-6 hover:border-muted-foreground/50 transition-all shadow-sm hover:shadow-xl relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                  <span className="font-bold text-primary">{project.app_name.substring(0, 2).toUpperCase()}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setSettingsProject(project)}
                    className="p-1.5 bg-muted rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors" 
                    title="CI/CD & Settings"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => openLogViewer(project)}
                    className="p-1.5 bg-muted rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors" 
                    title="View Logs"
                  >
                    <Terminal className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmProject(project)}
                    className="p-1.5 bg-red-500/10 rounded-md hover:bg-red-500/20 text-red-500 transition-colors" 
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <Link 
                  href={`/project/${project.app_name}`}
                  className="font-semibold text-lg hover:text-primary transition-colors hover:underline"
                >
                  {project.app_name}
                </Link>
                {project.status === "active" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Active
                  </span>
                )}
                {project.status === "deploying" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-full border border-yellow-500/20">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Deploying
                  </span>
                )}
                {project.status === "failed" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Failed
                  </span>
                )}
                {project.arch_type === "fullstack" && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                    Fullstack
                  </span>
                )}
                {project.arch_type === "monorepo" && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                    Monorepo
                  </span>
                )}
                {(project.arch_type === "archive" || project.arch_type === "archive_db" || project.repo_url?.startsWith("archive:")) && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20 flex items-center gap-1">
                    <FolderArchive className="w-2.5 h-2.5" />
                    Archive
                  </span>
                )}
              </div>
              
              <a
                href={`https://${project.app_domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground text-sm flex items-center gap-1 hover:text-primary transition-colors mb-4"
              >
                {project.app_domain}
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="pt-4 border-t border-border flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {project.repo_url?.startsWith("archive:") ? (
                    <>
                      <FolderArchive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate font-mono">{project.repo_url.replace("archive:", "")}</span>
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{project.repo_url?.replace("https://github.com/", "")}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    <span>main</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {deleteConfirmProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-md w-full"
            >
              <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                Delete Project
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                Are you sure you want to delete <span className="font-semibold text-foreground">{deleteConfirmProject.app_name}</span>? This action cannot be undone and will permanently remove the application from the server.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeleteConfirmProject(null)}
                  className="px-4 py-2 rounded-md hover:bg-muted text-foreground text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors shadow-lg shadow-red-900/20"
                >
                  Yes, delete project
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Viewer Modal */}
      <AnimatePresence>
        {logViewerProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0D0D0D] border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-w-3xl w-full h-[600px]"
            >
              <div className="bg-[#1A1A1A] border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>

                  {!isDeleting ? (
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-border/80">
                      <button
                        type="button"
                        onClick={() => setModalLogTab('runtime')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                          modalLogTab === 'runtime'
                            ? 'bg-foreground text-background shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Runtime Logs</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalLogTab('build')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                          modalLogTab === 'build'
                            ? 'bg-foreground text-background shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5 text-sky-400" />
                        <span>Build Logs</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5" />
                      Deleting {logViewerProject.app_name}...
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {!isDeleting && podName && modalLogTab === 'runtime' && (
                    <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block truncate max-w-[200px]">
                      Pod: {podName}
                    </span>
                  )}
                  <button 
                    onClick={closeLogViewer}
                    disabled={isDeleting}
                    className="p-1 rounded-md hover:bg-white/10 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 font-mono text-sm flex-1 overflow-y-auto text-gray-300">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Fetching logs...
                  </div>
                ) : (
                  <>
                    {logs.map((log, i) => (
                      <div key={i} className="mb-2 leading-relaxed whitespace-pre-wrap break-all">
                        {log.includes("✅") ? (
                          <span className="text-green-400 font-semibold">{log}</span>
                        ) : log.includes("❌") || log.includes("ERROR") || log.includes("[LỖI") ? (
                          <span className="text-red-400 font-semibold">{log}</span>
                        ) : log.includes("DELETED") ? (
                          <span className="text-yellow-400 font-semibold">{log}</span>
                        ) : (
                          log
                        )}
                      </div>
                    ))}
                    {isDeleting && (
                      <div className="flex items-center gap-2 text-muted-foreground mt-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing deletion...</span>
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CI/CD & Project Settings Modal */}
      <AnimatePresence>
        {settingsProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    {settingsProject.app_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground leading-none">
                      {settingsProject.app_name} Settings
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      CI/CD Automation & Redeployment
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/project/${settingsProject.app_name}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-foreground transition-colors font-medium"
                  >
                    Full Details
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button 
                    onClick={() => setSettingsProject(null)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto">
                <ProjectCicdSettings 
                  appName={settingsProject.app_name} 
                  onOpenTerminal={() => {
                    const proj = settingsProject;
                    setSettingsProject(null);
                    setLogViewerProject(proj);
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
