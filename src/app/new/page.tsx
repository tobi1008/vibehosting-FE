"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/ProjectContext";
import { parseDeploymentSession, countDeployMarkers, extractCurrentSessionLines } from "@/lib/deployment";
import {
  GitBranch,
  Globe,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ExternalLink,
  Search,
  Server,
  Database,
  UploadCloud,
  FileCode,
  X,
  Rocket,
  Zap,
  Layers,
  HardDrive,
  ChevronDown,
  Lock,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Boxes,
  Code2,
  Network,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { Octokit } from "@octokit/rest";

export type DatabaseType = "mysql" | "mariadb" | "postgresql" | "mongodb" | "redis";

export interface DatabaseOption {
  id: DatabaseType;
  name: string;
  tag: string;
  badgeColor: string;
  iconBg: string;
  description: string;
  acceptExtensions: string;
  fileHint: string;
}

export const DATABASE_OPTIONS: DatabaseOption[] = [
  {
    id: "mysql",
    name: "MySQL",
    tag: "RDBMS",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    description: "Standard relational database with InnoDB engine",
    acceptExtensions: ".sql,.dump",
    fileHint: "File backup .sql hoặc .dump",
  },
  {
    id: "mariadb",
    name: "MariaDB",
    tag: "RDBMS",
    badgeColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    description: "Fast, community-driven fork of MySQL",
    acceptExtensions: ".sql,.dump",
    fileHint: "File backup .sql hoặc .dump",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    tag: "SQL",
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    description: "Advanced enterprise-grade relational database",
    acceptExtensions: ".sql,.dump",
    fileHint: "File backup .sql hoặc .dump",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    tag: "NoSQL",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    description: "Document-oriented NoSQL database for flexible schemas",
    acceptExtensions: ".json,.sql,.archive,.gz",
    fileHint: "File backup .json, .sql hoặc .archive",
  },
  {
    id: "redis",
    name: "Redis",
    tag: "In-Memory",
    badgeColor: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    iconBg: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    description: "In-memory key-value data store, cache & broker",
    acceptExtensions: ".rdb,.json,.sql",
    fileHint: "File backup snapshot .rdb, .json hoặc .sql",
  },
];

export default function NewProject() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { addProject, updateProjectStatus } = useProjects();
  
  const [repos, setRepos] = useState<any[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [isGithubConnected, setIsGithubConnected] = useState<boolean>(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [patInput, setPatInput] = useState("");
  const [isSavingPat, setIsSavingPat] = useState(false);
  const [showPatForm, setShowPatForm] = useState(false);
  const [patSuccess, setPatSuccess] = useState<string | null>(null);

  const [repoUrl, setRepoUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [domainType, setDomainType] = useState<"system" | "custom">("system");
  const [customDomain, setCustomDomain] = useState("");
  const [systemSubdomain, setSystemSubdomain] = useState("");
  const [randomSubdomain, setRandomSubdomain] = useState("");

  // Architecture & Database state
  const [archType, setArchType] = useState<"web_only" | "web_db" | "fullstack" | "monorepo">("web_only");
  const [beRepoUrl, setBeRepoUrl] = useState("");
  const [feRepoUrl, setFeRepoUrl] = useState("");
  const [beDomain, setBeDomain] = useState("");
  const [feDomain, setFeDomain] = useState("");
  const [hasFrontend, setHasFrontend] = useState(true);
  const [activeRepoTarget, setActiveRepoTarget] = useState<"be" | "fe">("be");

  const [selectedDb, setSelectedDb] = useState<DatabaseType>("mysql");
  const [dbFile, setDbFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ type: "success" | "error"; text: string; url?: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [currentDeploy, setCurrentDeploy] = useState<{
    app_name: string;
    app_domain: string;
    repo_url: string;
    initialMarkerCount?: number;
    arch_type?: string;
    be_repo_url?: string | null;
    fe_repo_url?: string | null;
    be_domain?: string | null;
    fe_domain?: string | null;
    db_type?: DatabaseType | null;
  } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    setRandomSubdomain(Math.random().toString(36).substring(2, 8));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qRepo = params.get("repo_url");
      const qName = params.get("app_name");
      const qArch = params.get("arch") || params.get("type");
      if (qRepo) setRepoUrl(qRepo);
      if (qName) {
        setAppName(qName);
        setSystemSubdomain(qName.toLowerCase().replace(/[^a-z0-9-]/g, ""));
      }
      if (qArch === "monorepo" || qArch === "fullstack" || qArch === "web_db" || qArch === "web_only") {
        setArchType(qArch);
      }
    }
  }, []);

  const fetchRepos = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError(null);
    const token = (session as any)?.accessToken;
    if (token) {
      setGithubToken(token);
      try {
        const octokit = new Octokit({ auth: token });
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          sort: "updated",
          per_page: 100,
          affiliation: "owner,collaborator",
        });
        setRepos(data);
        setFilteredRepos(data);
        setIsGithubConnected(true);
        setRepoError(null);
      } catch (error: any) {
        console.error("Failed to fetch repos via OAuth", error);
        setIsGithubConnected(false);
        setRepoError(error?.message || "Không thể tải danh sách repository từ GitHub.");
      } finally {
        setLoadingRepos(false);
      }
    } else {
      // Check if user connected GitHub via Profile / PAT
      try {
        const res = await fetch("/api/user/github/repos");
        const data = await res.json();

        if (res.ok && data.connected) {
          setIsGithubConnected(true);
          setGithubToken(data.githubToken || null);
          setGithubUsername(data.githubUsername || null);
          const repoList = Array.isArray(data.repos) ? data.repos : [];
          setRepos(repoList);
          setFilteredRepos(repoList);
          setRepoError(null);
        } else {
          setIsGithubConnected(false);
          setGithubToken(null);
          setGithubUsername(null);
          setRepos([]);
          setFilteredRepos([]);
          if (data.error) {
            setRepoError(data.error);
          } else {
            setRepoError(null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch connected repos", error);
        setIsGithubConnected(false);
        setRepoError("Không thể kết nối đến máy chủ để lấy danh sách repository.");
      } finally {
        setLoadingRepos(false);
      }
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchRepos();
    }
  }, [session, fetchRepos]);

  const handleSavePat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) return;
    setIsSavingPat(true);
    setRepoError(null);
    setPatSuccess(null);
    try {
      const res = await fetch("/api/user/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: patInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPatSuccess(`Đã kết nối thành công với GitHub (@${data.githubUsername})`);
        setPatInput("");
        setShowPatForm(false);
        await fetchRepos();
      } else {
        setRepoError(data.error || "Token không hợp lệ hoặc thiếu quyền repo/read:user.");
      }
    } catch (err: any) {
      setRepoError("Lỗi kết nối máy chủ khi lưu token GitHub.");
    } finally {
      setIsSavingPat(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      setFilteredRepos(repos.filter(r => r.full_name.toLowerCase().includes(searchQuery.toLowerCase())));
    } else {
      setFilteredRepos(repos);
    }
  }, [searchQuery, repos]);

  const autoSetAppName = (rawName: string) => {
    const cleanName = rawName.replace(/-(backend|be|api|frontend|fe|web|ui)$/i, "");
    if (!appName) {
      setAppName(cleanName);
      setSystemSubdomain(cleanName.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    }
  };

  const selectRepo = (repo: any) => {
    if (archType === "fullstack") {
      if (activeRepoTarget === "be") {
        setBeRepoUrl(repo.clone_url);
        setActiveRepoTarget("fe");
      } else {
        setFeRepoUrl(repo.clone_url);
        setActiveRepoTarget("be");
      }
      autoSetAppName(repo.name);
    } else {
      setRepoUrl(repo.clone_url);
      setAppName(repo.name);
      setSystemSubdomain(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    }
  };

  // Auto slugify app name
  const slugifiedName = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const activeSystemSubdomain = systemSubdomain.trim() || randomSubdomain;
  const finalDomain = domainType === "system" 
    ? (activeSystemSubdomain ? `${activeSystemSubdomain}.vibe.quyenlt.com` : "...") 
    : customDomain;

  const finalFeDomain = domainType === "system"
    ? (activeSystemSubdomain ? `${activeSystemSubdomain}.vibe.quyenlt.com` : "...")
    : (feDomain.trim() || (customDomain ? `${customDomain}` : "..."));

  const finalBeDomain = domainType === "system"
    ? (activeSystemSubdomain ? `api-${activeSystemSubdomain}.vibe.quyenlt.com` : "...")
    : (beDomain.trim() || (customDomain ? `api.${customDomain}` : "..."));

  // Auto scroll logs
  useEffect(() => {
    const terminalElem = document.getElementById("terminal-container");
    if (terminalElem) {
      terminalElem.scrollTop = terminalElem.scrollHeight;
    }
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Log Polling Ref
  const logIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
        logIntervalRef.current = null;
      }
    };
  }, []);

  // Polling logs every 2 seconds immediately
  const startLogPolling = useCallback((targetAppName: string, targetDomain: string) => {
    if (logIntervalRef.current) {
      clearInterval(logIntervalRef.current);
      logIntervalRef.current = null;
    }

    const logsUrl = `/api/logs/${encodeURIComponent(targetAppName)}`;

    const pollLogs = async () => {
      try {
        const res = await fetch(logsUrl);
        if (!res.ok) return;

        const data = await res.json();
        if (data && data.logs && data.logs.trim()) {
          const rawLines = data.logs.split("\n").filter((l: string) => l.trim().length > 0);
          if (rawLines.length > 0) {
            setLogs(rawLines.map((l: string) => (l.startsWith(">") ? l : `> ${l}`)));
          }

          // Tự động cuộn terminal xuống đáy
          requestAnimationFrame(() => {
            const terminalElem = document.getElementById("terminal-container");
            if (terminalElem) {
              terminalElem.scrollTop = terminalElem.scrollHeight;
            }
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
          });

          const upperLogs = data.logs.toUpperCase();
          const isDone = data.logs.includes("DONE") || 
                         upperLogs.includes("HOÀN TẤT") || 
                         upperLogs.includes("SUCCESSFULLY DEPLOYED");
          const isFailed = !isDone && (
            (upperLogs.includes("ERROR") && 
             !upperLogs.includes("0 ERROR") && 
             !upperLogs.includes("ERRORS: 0") && 
             !upperLogs.includes("0 ERRORS")) || 
            upperLogs.includes("FAILED") || 
            upperLogs.includes("THẤT BẠI") ||
            upperLogs.includes("FATAL:")
          );

          if (isDone) {
            if (logIntervalRef.current) {
              clearInterval(logIntervalRef.current);
              logIntervalRef.current = null;
            }
            const finalUrl = `https://${targetDomain}`;
            setLogs((prev) => [
              ...prev,
              "> ✅ Deployment successful!",
              `> 🌐 App URL: ${finalUrl}`,
            ]);
            setDeployResult({
              type: "success",
              text: `Successfully deployed ${targetAppName}!`,
              url: finalUrl,
            });
            updateProjectStatus(targetAppName, "active");
          } else if (isFailed) {
            if (logIntervalRef.current) {
              clearInterval(logIntervalRef.current);
              logIntervalRef.current = null;
            }
            setLogs((prev) => [...prev, "> ❌ Deployment failed"]);
            setDeployResult({
              type: "error",
              text: "Deployment failed. Please check the logs.",
            });
            updateProjectStatus(targetAppName, "failed");
          }
        }
      } catch (e) {
        console.warn("Đang chờ kết nối log...", e);
      }
    };

    pollLogs();
    logIntervalRef.current = setInterval(pollLogs, 2000);
  }, [updateProjectStatus]);

  const currentDbConfig = DATABASE_OPTIONS.find((d) => d.id === selectedDb) || DATABASE_OPTIONS[0];

  const handleSelectDatabase = (dbId: DatabaseType) => {
    setSelectedDb(dbId);
    setFileError(null);
    const targetConfig = DATABASE_OPTIONS.find((d) => d.id === dbId);
    if (dbFile && targetConfig) {
      const allowed = targetConfig.acceptExtensions.split(",").map((e) => e.trim().toLowerCase());
      const ext = "." + dbFile.name.split(".").pop()?.toLowerCase();
      if (!allowed.includes(ext)) {
        setDbFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = (file: File) => {
    const allowed = currentDbConfig.acceptExtensions.split(",").map((e) => e.trim().toLowerCase());
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setFileError(`Chỉ chấp nhận file định dạng ${currentDbConfig.acceptExtensions} cho ${currentDbConfig.name}`);
      return;
    }
    setDbFile(file);
    setFileError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setDbFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (archType === "fullstack") {
      if (!appName || !beRepoUrl.trim() || !feRepoUrl.trim()) {
        setFileError("Vui lòng nhập Tên dự án, Backend Repository URL và Frontend Repository URL.");
        return;
      }
      if (domainType === "custom" && (!beDomain.trim() || !feDomain.trim())) {
        setFileError("Vui lòng nhập đầy đủ Domain cho cả Backend và Frontend.");
        return;
      }
    } else if (archType === "monorepo") {
      if (!appName || !repoUrl.trim()) {
        setFileError("Vui lòng nhập Tên định danh ứng dụng và Repository URL Monorepo.");
        return;
      }
      if (domainType === "custom" && !beDomain.trim()) {
        setFileError("Vui lòng nhập Tên miền Backend (be_domain).");
        return;
      }
    } else {
      if (!repoUrl || !appName || (domainType === "custom" && !customDomain)) {
        return;
      }
      if (archType === "web_db" && !dbFile) {
        setFileError(`Vui lòng tải lên backup_file cho cơ sở dữ liệu ${currentDbConfig.name}`);
        return;
      }
    }

    setIsDeploying(true);
    setDeployResult(null);
    setLogs([
      "> Sending deployment request to backend...",
      `> Architecture: ${
        archType === 'monorepo'
          ? 'Monorepo / Open Source (Single Repo)'
          : archType === 'fullstack'
          ? 'Fullstack (FE + BE + DB)'
          : archType === 'web_db'
          ? 'Web App + Internal DB'
          : 'Web Only'
      }`,
      `> Target API: ${
        archType === 'monorepo'
          ? 'POST /api/deploy-monorepo (application/json)'
          : archType === 'fullstack'
          ? 'POST /api/deploy-fullstack (multipart/form-data)'
          : archType === 'web_db'
          ? 'POST /api/deploy-with-db (multipart/form-data)'
          : 'POST /api/deploy (application/json)'
      }`,
      "> Đang gửi yêu cầu khởi tạo đến máy chủ...",
    ]);

    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://116.118.50.199:8080/api/deploy";
    const baseUrl = rawApiUrl.replace(/\/api\/deploy\/?$/, "");

    try {
      let response: Response;

      if (archType === "monorepo") {
        // Trường hợp 4: Monorepo / Open Source (1 Repo duy nhất) -> application/json
        const monorepoPayload: {
          app_name: string;
          repo_url: string;
          be_domain: string;
          fe_domain?: string;
          db_type: string;
          github_token?: string;
        } = {
          app_name: slugifiedName,
          repo_url: repoUrl.trim(),
          be_domain: finalBeDomain.trim(),
          db_type: selectedDb,
        };

        if (hasFrontend && finalFeDomain && finalFeDomain.trim()) {
          monorepoPayload.fe_domain = finalFeDomain.trim();
        }

        if (githubToken && githubToken.trim()) {
          monorepoPayload.github_token = githubToken.trim();
        }

        response = await fetch(`/api/deploy-monorepo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(monorepoPayload),
        });
      } else if (archType === "fullstack") {
        // Trường hợp 3: Fullstack (Frontend + Backend + Shared Database) -> multipart/form-data
        const formData = new FormData();
        formData.append("app_name", slugifiedName);
        formData.append("be_repo_url", beRepoUrl.trim());
        formData.append("be_domain", finalBeDomain.trim());
        formData.append("fe_repo_url", feRepoUrl.trim());
        formData.append("fe_domain", finalFeDomain.trim());
        formData.append("db_type", selectedDb);
        if (dbFile) formData.append("backup_file", dbFile);
        if (githubToken) formData.append("github_token", githubToken);

        response = await fetch(`/api/deploy-fullstack`, {
          method: "POST",
          body: formData,
        });
      } else if (archType === "web_db") {
        // Trường hợp 2: Web App + Internal Database -> multipart/form-data
        const formData = new FormData();
        formData.append("repo_url", repoUrl);
        formData.append("app_name", slugifiedName);
        formData.append("app_domain", finalDomain);
        formData.append("db_type", selectedDb);
        if (dbFile) formData.append("backup_file", dbFile);
        if (githubToken) formData.append("github_token", githubToken);

        response = await fetch(`/api/deploy-with-db`, {
          method: "POST",
          body: formData,
        });
      } else {
        // Trường hợp 1: Web Application Only -> JSON
        const payload: {
          repo_url: string;
          app_name: string;
          app_domain: string;
          github_token?: string | null;
        } = {
          repo_url: repoUrl,
          app_name: slugifiedName,
          app_domain: finalDomain,
        };

        if (githubToken) {
          payload.github_token = githubToken;
        }

        response = await fetch(`/api/deploy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json().catch(() => null);

      if (!response.ok || (data && (data.status === "error" || data.status === "failed"))) {
        throw new Error(data?.detail || data?.message || `Error: ${response.status} ${response.statusText}`);
      }

      const finalAppDomain = archType === "fullstack"
        ? finalFeDomain
        : (archType === "monorepo" && hasFrontend)
        ? finalFeDomain
        : (archType === "monorepo" ? finalBeDomain : finalDomain);

      // Thông báo thành công theo đúng yêu cầu
      setToastMessage(data?.message || "Đang khởi tạo dự án. Vui lòng chuyển sang màn hình Logs để xem tiến trình hệ thống cấu hình K3s.");

      setLogs((prev) => [
        ...prev, 
        "> ✅ Request accepted by backend.", 
        archType !== 'web_only' ? `> Database: ${currentDbConfig.name}` : '> Database: None (Web Only)',
        "> Đang kết nối tới kho mã nguồn & khởi động tiến trình build...",
      ]);
      
      const deployedApp = {
        app_name: slugifiedName,
        app_domain: finalAppDomain,
        repo_url: archType === "fullstack" ? feRepoUrl : repoUrl,
        arch_type: archType,
        be_repo_url: archType === "fullstack" ? beRepoUrl : (archType === "monorepo" ? repoUrl : null),
        fe_repo_url: archType === "fullstack" ? feRepoUrl : (archType === "monorepo" && hasFrontend ? repoUrl : null),
        be_domain: (archType === "fullstack" || archType === "monorepo") ? finalBeDomain : null,
        fe_domain: (archType === "fullstack" || (archType === "monorepo" && hasFrontend)) ? finalFeDomain : null,
        db_type: archType !== "web_only" ? selectedDb : null,
      };

      setCurrentDeploy(deployedApp);

      // KÍCH HOẠT POLLING LOG NGAY LẬP TỨC
      startLogPolling(slugifiedName, finalAppDomain);

      // Thêm dự án vào trạng thái ban đầu (mặc định tắt auto CI/CD)
      await addProject({
        app_name: deployedApp.app_name,
        repo_url: deployedApp.repo_url,
        app_domain: deployedApp.app_domain,
        status: "deploying",
        arch_type: deployedApp.arch_type,
        db_type: deployedApp.db_type,
        be_repo_url: deployedApp.be_repo_url,
        fe_repo_url: deployedApp.fe_repo_url,
        be_domain: deployedApp.be_domain,
        fe_domain: deployedApp.fe_domain,
        auto_cicd: false,
      });

      fetch(`/api/apps/${encodeURIComponent(slugifiedName)}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_cicd: false }),
      }).catch(() => {});

      // Xóa trắng form (Reset)
      setRepoUrl("");
      setBeRepoUrl("");
      setFeRepoUrl("");
      setBeDomain("");
      setFeDomain("");
      setHasFrontend(true);
      setAppName("");
      setSystemSubdomain("");
      setCustomDomain("");
      setDbFile(null);
      setFileError(null);
      setArchType("web_only");
      setSelectedDb("mysql");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (error: any) {
      console.error("Deploy Error:", error);
      setIsDeploying(false);
      const isNetworkError =
        error?.name === "TypeError" ||
        error?.message?.includes("NetworkError") ||
        error?.message?.includes("Failed to fetch") ||
        error?.message?.includes("connect ECONNREFUSED");

      const displayError = isNetworkError
        ? "NetworkError: Không thể kết nối tới server Backend (http://116.118.50.199:8080). Vui lòng kiểm tra lại dịch vụ backend API hoặc mạng kết nối."
        : error.message || "Failed to submit deployment.";

      setLogs(prev => [...prev, `> ❌ Request failed: ${displayError}`]);
      setDeployResult({ type: "error", text: displayError });
    }
  };

  if (!session) return null;

  return (
    <div className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Let's build something new.</h1>
          <p className="text-muted-foreground">To deploy a new Project, import an existing Git Repository or enter a URL.</p>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {(toastMessage || patSuccess) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-start justify-between gap-3 shadow-md"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">{toastMessage || patSuccess}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {toastMessage ? "Hệ thống đang chuyển cấu hình đến Nixpacks & K3s runner." : "Danh sách repository đã được tự động làm mới."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setToastMessage(null);
                setPatSuccess(null);
              }}
              className="text-muted-foreground hover:text-foreground text-xs p-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isDeploying ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col lg:flex-row gap-8"
          >
            {/* Left side: GitHub Repos */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4">
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-foreground" />
                    <h2 className="font-semibold text-sm">Import Git Repository</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {isGithubConnected && githubUsername && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                        @{githubUsername}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => fetchRepos()}
                      disabled={loadingRepos}
                      title="Làm mới danh sách repository"
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
                <div className="p-4 border-b border-border bg-background">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm repository..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {loadingRepos ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Đang tải danh sách repositories...
                    </div>
                  ) : !isGithubConnected ? (
                    <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-3 p-5 text-center">
                      {repoError ? (
                        <>
                          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div className="max-w-xs">
                            <p className="font-semibold text-foreground text-sm">Lỗi kết nối GitHub</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {repoError}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <GitBranch className="w-10 h-10 opacity-40 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-foreground text-sm">Chưa kết nối GitHub</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                              Kết nối tài khoản GitHub để duyệt và clone danh sách repository của bạn nhanh chóng.
                            </p>
                          </div>
                        </>
                      )}

                      {/* Quick PAT input right on /new page */}
                      <div className="w-full max-w-sm mt-1">
                        {showPatForm ? (
                          <form onSubmit={handleSavePat} className="flex flex-col gap-2 p-3 bg-muted/40 rounded-lg border border-border text-left">
                            <label className="text-[11px] font-medium text-foreground flex items-center justify-between">
                              <span>Nhập Personal Access Token mới:</span>
                              <button
                                type="button"
                                onClick={() => setShowPatForm(false)}
                                className="text-muted-foreground hover:text-foreground text-[10px]"
                              >
                                Đóng
                              </button>
                            </label>
                            <input
                              type="password"
                              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                              value={patInput}
                              onChange={(e) => setPatInput(e.target.value)}
                              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-foreground"
                              required
                            />
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <a
                                href="https://github.com/settings/tokens/new?description=VibeHosting&scopes=repo,read:user"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-muted-foreground underline hover:text-foreground flex items-center gap-1"
                              >
                                Tạo token GitHub <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <button
                                type="submit"
                                disabled={isSavingPat}
                                className="px-3 py-1 bg-foreground text-background hover:bg-foreground/90 rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isSavingPat ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                                Lưu & Kết nối
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowPatForm(true)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-foreground text-background hover:bg-foreground/90 rounded-md font-medium text-xs transition-colors shadow-xs"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              {repoError ? "Cập nhật Token mới" : "Nhập Token nhanh"}
                            </button>
                            <Link
                              href="/profile"
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-md font-medium text-xs transition-colors"
                            >
                              Đến trang Profile
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : filteredRepos.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {filteredRepos.map((repo) => {
                        const isSingleSelected = repoUrl === repo.clone_url;
                        const isBeSelected = beRepoUrl === repo.clone_url;
                        const isFeSelected = feRepoUrl === repo.clone_url;
                        const isSelected = archType === "fullstack"
                          ? (isBeSelected || isFeSelected)
                          : isSingleSelected;

                        return (
                          <div
                            key={repo.id}
                            onClick={() => selectRepo(repo)}
                            className={`flex items-center justify-between p-3 rounded-md transition-all group cursor-pointer ${
                              isSelected
                                ? "bg-muted border border-foreground/30 shadow-xs"
                                : "hover:bg-muted/50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div
                                className={`w-8 h-8 rounded flex items-center justify-center border flex-shrink-0 ${
                                  isSelected
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-muted border-border"
                                }`}
                              >
                                <GitBranch className="w-4 h-4" />
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{repo.full_name}</p>
                                  {(repo.is_private || repo.private) && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                      <Lock className="w-2.5 h-2.5" />
                                      Private
                                    </span>
                                  )}
                                  {archType === "fullstack" && isBeSelected && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                      BE
                                    </span>
                                  )}
                                  {archType === "fullstack" && isFeSelected && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                      FE
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  Updated {new Date(repo.updated_at).toLocaleDateString()}
                                  {repo.language ? ` • ${repo.language}` : ""}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            {archType === "fullstack" ? (
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBeRepoUrl(repo.clone_url);
                                    autoSetAppName(repo.name);
                                  }}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                    isBeSelected
                                      ? "bg-purple-600 text-white shadow-xs"
                                      : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                                  }`}
                                  title="Gán repository này làm Backend"
                                >
                                  {isBeSelected ? "✓ BE" : "Set BE"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFeRepoUrl(repo.clone_url);
                                    autoSetAppName(repo.name);
                                  }}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                    isFeSelected
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                                  }`}
                                  title="Gán repository này làm Frontend"
                                >
                                  {isFeSelected ? "✓ FE" : "Set FE"}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectRepo(repo);
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                  isSelected
                                    ? "bg-emerald-500 text-white"
                                    : "opacity-0 group-hover:opacity-100 bg-foreground text-background hover:bg-foreground/90"
                                }`}
                              >
                                {isSelected ? "Selected" : "Import"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2 p-6 text-center">
                      <p>Không tìm thấy repository nào{searchQuery ? ` phù hợp với "${searchQuery}"` : ""}.</p>
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => fetchRepos()}
                          className="text-xs text-foreground underline hover:text-primary flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Tải lại
                        </button>
                        <Link href="/profile" className="text-xs text-muted-foreground hover:text-foreground underline">
                          Quản lý kết nối GitHub ở Profile
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Configuration Form */}
            <div className="w-full lg:w-1/2">
              <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-6 sm:p-8 flex flex-col gap-6">
                
                {/* 1. Project Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="appName" className="text-sm font-medium">
                    Project Name
                  </label>
                  <input
                    id="appName"
                    type="text"
                    placeholder="my-awesome-app"
                    className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all text-sm"
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value);
                      setSystemSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                    required
                  />
                  {appName && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                      <span>app_name:</span>
                      <span className="text-foreground font-semibold">{slugifiedName}</span>
                    </p>
                  )}
                </div>

                {/* 2. Architecture Type Selection */}
                <div className="flex flex-col gap-3 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Server className="w-4 h-4 text-foreground" />
                      Architecture Type
                    </label>
                    <span className="text-[11px] text-muted-foreground">Deployment Model</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* Option 1: Web Application Only */}
                    <button
                      type="button"
                      onClick={() => {
                        setArchType("web_only");
                        setFileError(null);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all relative ${
                        archType === "web_only"
                          ? "border-foreground bg-foreground/5 shadow-xs ring-1 ring-foreground/20"
                          : "border-border bg-background hover:border-foreground/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          archType === "web_only" ? "bg-foreground text-background" : "bg-muted text-foreground"
                        }`}>
                          <Server className="w-3.5 h-3.5" />
                        </div>
                        {archType === "web_only" && (
                          <div className="w-2 h-2 rounded-full bg-foreground" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Web Only</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          Standalone Web App / API
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Web App + Internal Database */}
                    <button
                      type="button"
                      onClick={() => {
                        setArchType("web_db");
                        setFileError(null);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all relative ${
                        archType === "web_db"
                          ? "border-foreground bg-foreground/5 shadow-xs ring-1 ring-foreground/20"
                          : "border-border bg-background hover:border-foreground/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          archType === "web_db" ? "bg-foreground text-background" : "bg-muted text-foreground"
                        }`}>
                          <Database className="w-3.5 h-3.5" />
                        </div>
                        {archType === "web_db" && (
                          <div className="w-2 h-2 rounded-full bg-foreground" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Web + Database</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          K3s Internal Database
                        </p>
                      </div>
                    </button>

                    {/* Option 3: Fullstack (FE + BE + DB) */}
                    <button
                      type="button"
                      onClick={() => {
                        setArchType("fullstack");
                        setFileError(null);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all relative ${
                        archType === "fullstack"
                          ? "border-purple-500 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30"
                          : "border-border bg-background hover:border-purple-500/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          archType === "fullstack" ? "bg-purple-600 text-white" : "bg-muted text-foreground"
                        }`}>
                          <Boxes className="w-3.5 h-3.5" />
                        </div>
                        {archType === "fullstack" && (
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Fullstack 2-Repo</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          Frontend + Backend + DB
                        </p>
                      </div>
                    </button>

                    {/* Option 4: Monorepo / Open Source (1 Repo duy nhất) */}
                    <button
                      type="button"
                      onClick={() => {
                        setArchType("monorepo");
                        setFileError(null);
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all relative ${
                        archType === "monorepo"
                          ? "border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/30"
                          : "border-border bg-background hover:border-indigo-500/40 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          archType === "monorepo" ? "bg-indigo-600 text-white" : "bg-muted text-foreground"
                        }`}>
                          <Code2 className="w-3.5 h-3.5" />
                        </div>
                        {archType === "monorepo" ? (
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-500 text-white rounded">NEW</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground block">Monorepo / Open Source</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          Single Repo (FE + BE + DB)
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 3. Repository & Domain Configurations */}
                {archType === "fullstack" ? (
                  <div className="flex flex-col gap-4 pt-4 border-t border-border">
                    {/* Domain mode switch */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Cấu hình Domain
                      </label>
                      <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border text-xs">
                        <button
                          type="button"
                          onClick={() => setDomainType("system")}
                          className={`px-2 py-1 rounded font-medium transition-all ${
                            domainType === "system" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          System Subdomain
                        </button>
                        <button
                          type="button"
                          onClick={() => setDomainType("custom")}
                          className={`px-2 py-1 rounded font-medium transition-all ${
                            domainType === "custom" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Custom Domain
                        </button>
                      </div>
                    </div>

                    {/* Backend Card */}
                    <div className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                      activeRepoTarget === "be"
                        ? "border-purple-500/60 bg-purple-500/5 shadow-xs ring-1 ring-purple-500/30"
                        : "border-border bg-card/60"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            <Server className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-foreground block">Backend Repository (be_repo_url)</span>
                            <span className="text-[10px] text-muted-foreground">API service, server logic</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveRepoTarget("be")}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all ${
                            activeRepoTarget === "be"
                              ? "bg-purple-600 text-white"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {activeRepoTarget === "be" ? "● Đang chọn" : "Bấm chọn repo"}
                        </button>
                      </div>

                      <input
                        type="url"
                        placeholder="https://github.com/username/backend-repo"
                        value={beRepoUrl}
                        onChange={(e) => setBeRepoUrl(e.target.value)}
                        onFocus={() => setActiveRepoTarget("be")}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-xs font-mono"
                        required
                      />

                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Backend Domain (be_domain):</span>
                          <span className="font-mono text-purple-400 font-semibold">{finalBeDomain}</span>
                        </div>
                        {domainType === "custom" && (
                          <input
                            type="text"
                            placeholder="e.g. api.domain.com"
                            value={beDomain}
                            onChange={(e) => setBeDomain(e.target.value)}
                            className="w-full bg-background border border-border rounded-md px-3 py-1.5 outline-none focus:border-purple-500 text-xs font-mono"
                            required
                          />
                        )}
                      </div>
                    </div>

                    {/* Frontend Card */}
                    <div className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                      activeRepoTarget === "fe"
                        ? "border-emerald-500/60 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30"
                        : "border-border bg-card/60"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Globe className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-foreground block">Frontend Repository (fe_repo_url)</span>
                            <span className="text-[10px] text-muted-foreground">Web client (React, Vue, Vite, NextJS, ...)</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveRepoTarget("fe")}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all ${
                            activeRepoTarget === "fe"
                              ? "bg-emerald-600 text-white"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {activeRepoTarget === "fe" ? "● Đang chọn" : "Bấm chọn repo"}
                        </button>
                      </div>

                      <input
                        type="url"
                        placeholder="https://github.com/username/frontend-repo"
                        value={feRepoUrl}
                        onChange={(e) => setFeRepoUrl(e.target.value)}
                        onFocus={() => setActiveRepoTarget("fe")}
                        className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-xs font-mono"
                        required
                      />

                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Frontend Domain (fe_domain):</span>
                          <span className="font-mono text-emerald-400 font-semibold">{finalFeDomain}</span>
                        </div>
                        {domainType === "custom" && (
                          <input
                            type="text"
                            placeholder="e.g. domain.com"
                            value={feDomain}
                            onChange={(e) => setFeDomain(e.target.value)}
                            className="w-full bg-background border border-border rounded-md px-3 py-1.5 outline-none focus:border-emerald-500 text-xs font-mono"
                            required
                          />
                        )}
                      </div>
                    </div>

                    {/* Automatic Wiring Banner */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px]">
                        <Network className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cơ chế liên kết Fullstack tự động:</span>
                      </div>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside text-[11px] leading-relaxed">
                        <li>
                          Backend tự động nhận cấu hình kết nối Database chung được cấp phát.
                        </li>
                        <li>
                          Frontend tự động được truyền <span className="text-foreground font-mono font-semibold">https://{finalBeDomain}</span> vào biến môi trường <span className="font-mono">VITE_API_URL</span> &amp; file <span className="font-mono">.env</span> trước khi build.
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : archType === "monorepo" ? (
                  /* Form Fields for Monorepo / Open Source (1 Repo duy nhất) */
                  <div className="flex flex-col gap-4 pt-4 border-t border-border">
                    {/* Repository URL input for Monorepo */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="repoUrlMonorepo" className="text-sm font-medium flex items-center gap-1.5">
                          <Code2 className="w-4 h-4 text-indigo-400" />
                          <span>GitHub Repository URL (repo_url)</span>
                          <span className="text-red-500 font-bold">*</span>
                        </label>
                        {isGithubConnected ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Private Repo Ready
                          </span>
                        ) : (
                          <Link
                            href="/profile"
                            className="text-[11px] text-muted-foreground hover:text-foreground underline"
                          >
                            Cần deploy Private Repo?
                          </Link>
                        )}
                      </div>
                      <input
                        id="repoUrlMonorepo"
                        type="url"
                        placeholder="https://github.com/user/project"
                        className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-mono"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        required
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Repository duy nhất chứa cả Frontend và Backend (hoặc dự án Open Source fullstack).
                      </p>
                    </div>

                    {/* Domain mode switch */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Cấu hình Domain Monorepo
                      </label>
                      <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border text-xs">
                        <button
                          type="button"
                          onClick={() => setDomainType("system")}
                          className={`px-2 py-1 rounded font-medium transition-all ${
                            domainType === "system" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          System Subdomain
                        </button>
                        <button
                          type="button"
                          onClick={() => setDomainType("custom")}
                          className={`px-2 py-1 rounded font-medium transition-all ${
                            domainType === "custom" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Custom Domain
                        </button>
                      </div>
                    </div>

                    {/* Backend Domain Card */}
                    <div className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/5 shadow-xs flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            <Server className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                              <span>Tên miền Backend API (be_domain)</span>
                              <span className="text-red-500 font-bold">*</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">Domain trỏ về dịch vụ API</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-semibold">
                          Bắt buộc
                        </span>
                      </div>

                      {domainType === "system" ? (
                        <div className="p-2.5 bg-background border border-border rounded-md font-mono text-xs text-indigo-400 font-semibold">
                          https://{finalBeDomain}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="api-app.vibe.quyenlt.com"
                          value={beDomain}
                          onChange={(e) => setBeDomain(e.target.value)}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-indigo-500 transition-all text-xs font-mono"
                          required
                        />
                      )}
                    </div>

                    {/* Frontend Domain Card */}
                    <div className="p-4 rounded-xl border border-border bg-card/60 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Globe className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-foreground">
                              Tên miền Frontend (fe_domain)
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Bỏ trống nếu repo này chỉ có duy nhất Backend
                            </span>
                          </div>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={hasFrontend}
                            onChange={(e) => setHasFrontend(e.target.checked)}
                            className="rounded border-border accent-emerald-500"
                          />
                          <span className="text-[11px] font-medium text-foreground">Có Frontend</span>
                        </label>
                      </div>

                      {hasFrontend ? (
                        domainType === "system" ? (
                          <div className="p-2.5 bg-background border border-border rounded-md font-mono text-xs text-emerald-400 font-semibold">
                            https://{finalFeDomain}
                          </div>
                        ) : (
                          <input
                            type="text"
                            placeholder="app.vibe.quyenlt.com"
                            value={feDomain}
                            onChange={(e) => setFeDomain(e.target.value)}
                            className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-emerald-500 transition-all text-xs font-mono"
                          />
                        )
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2.5 rounded-md">
                          Chế độ Backend-only: Hệ thống sẽ chỉ khởi chạy dịch vụ Backend API từ Monorepo.
                        </p>
                      )}
                    </div>

                    {/* Monorepo Info Banner */}
                    <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px]">
                        <Network className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Cơ chế triển khai Monorepo tự động:</span>
                      </div>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside text-[11px] leading-relaxed">
                        <li>Hệ thống tự động nhận diện và build cả 2 thành phần Frontend &amp; Backend trong cùng một repository.</li>
                        <li>Backend tự động nhận cấu hình kết nối Database chung được cấp phát.</li>
                        <li>Frontend tự động được liên kết và trỏ tới Domain của Backend.</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="repoUrl" className="text-sm font-medium">
                          Repository URL
                        </label>
                        {isGithubConnected ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Private Repo Ready
                          </span>
                        ) : (
                          <Link
                            href="/profile"
                            className="text-[11px] text-muted-foreground hover:text-foreground underline"
                          >
                            Cần deploy Private Repo?
                          </Link>
                        )}
                      </div>
                      <input
                        id="repoUrl"
                        type="url"
                        placeholder="https://github.com/username/repo"
                        className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all text-sm"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        required
                      />
                      {isGithubConnected && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>
                            Tự động sử dụng GitHub Token {githubUsername ? `@${githubUsername}` : "đã kết nối"} để xác thực và clone nếu repository ở chế độ Private.
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-border">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Domain Configuration
                      </label>
                      
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <button
                          type="button"
                          onClick={() => setDomainType("system")}
                          className={`py-2 px-3 rounded-md border text-sm font-medium transition-all ${
                            domainType === "system" 
                              ? "border-foreground bg-foreground/5 text-foreground" 
                              : "border-border text-muted-foreground hover:border-foreground/50"
                          }`}
                        >
                          System Subdomain
                        </button>
                        <button
                          type="button"
                          onClick={() => setDomainType("custom")}
                          className={`py-2 px-3 rounded-md border text-sm font-medium transition-all ${
                            domainType === "custom" 
                              ? "border-foreground bg-foreground/5 text-foreground" 
                              : "border-border text-muted-foreground hover:border-foreground/50"
                          }`}
                        >
                          Custom Domain
                        </button>
                      </div>

                      {domainType === "system" && (
                        <div className="flex">
                          <input
                            type="text"
                            placeholder="my-app"
                            className="w-full bg-background border border-border border-r-0 rounded-l-md px-3 py-2 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all flex-1 text-sm"
                            value={systemSubdomain}
                            onChange={(e) => setSystemSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                          />
                          <div className="bg-muted px-3 py-2 border border-border rounded-r-md text-muted-foreground text-sm flex items-center justify-center">
                            .vibe.quyenlt.com
                          </div>
                        </div>
                      )}

                      {domainType === "custom" && (
                        <input
                          type="text"
                          placeholder="e.g. myapp.com"
                          className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all text-sm"
                          value={customDomain}
                          onChange={(e) => setCustomDomain(e.target.value)}
                          required
                        />
                      )}

                      <div className="bg-muted/30 p-3 rounded-md border border-border flex flex-col gap-1 text-sm mt-2">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Final Domain</span>
                        <span className="font-mono text-foreground font-medium">{finalDomain}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* 4. Database Selection & File Upload */}
                <AnimatePresence>
                  {(archType === "web_db" || archType === "fullstack" || archType === "monorepo") && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-5 border-t border-border flex flex-col gap-4">
                        {/* Database Type Dropdown */}
                        <div className="flex flex-col gap-2">
                          <label htmlFor="dbTypeSelect" className="text-sm font-medium flex items-center justify-between">
                            <span className="flex items-center gap-2 text-foreground">
                              <Database className="w-4 h-4 text-foreground" />
                              {archType === "monorepo" 
                                ? "Loại Database Monorepo (db_type)" 
                                : archType === "fullstack" 
                                ? "Shared Database Type (db_type)" 
                                : "Database Type (db_type)"}
                            </span>
                            <span className="text-xs text-muted-foreground">Mặc định: MySQL</span>
                          </label>
                          <div className="relative">
                            <select
                              id="dbTypeSelect"
                              value={selectedDb}
                              onChange={(e) => handleSelectDatabase(e.target.value as DatabaseType)}
                              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all cursor-pointer text-foreground appearance-none font-medium pr-10"
                            >
                              <option value="mysql">MySQL (Relational Database - Mặc định)</option>
                              <option value="mariadb">MariaDB (Community SQL)</option>
                              <option value="postgresql">PostgreSQL (Advanced Object-Relational)</option>
                              <option value="mongodb">MongoDB (NoSQL Document Store)</option>
                              <option value="redis">Redis (In-Memory Key-Value Cache)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        {/* Selected Database Preview Banner */}
                        <div className="p-3 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${currentDbConfig.iconBg}`}>
                              {currentDbConfig.id === "mysql" && <Database className="w-4 h-4" />}
                              {currentDbConfig.id === "mariadb" && <Database className="w-4 h-4" />}
                              {currentDbConfig.id === "postgresql" && <HardDrive className="w-4 h-4" />}
                              {currentDbConfig.id === "mongodb" && <Layers className="w-4 h-4" />}
                              {currentDbConfig.id === "redis" && <Zap className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {currentDbConfig.name}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${currentDbConfig.badgeColor}`}>
                                  {currentDbConfig.tag}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {currentDbConfig.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Monorepo Auto-DDL Notice OR Backup File Upload */}
                        {archType === "monorepo" ? (
                          <div className="pt-2 border-t border-border/70 flex flex-col gap-2">
                            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-start gap-2.5">
                              <Zap className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold text-indigo-300 block">
                                  Tự động chạy ORM Auto-DDL &amp; Migration
                                </span>
                                <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                                  Dự án Monorepo / Open Source không cần tải lên file backup .sql. Hệ thống tự động cấp phát Database và liên kết thông tin kết nối vào Backend để ORM (Prisma, TypeORM, Hibernate, v.v.) tự động đồng bộ cấu trúc bảng khi khởi động.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Backup File Upload Area for web_db and fullstack */
                          <div className="pt-3 border-t border-border/70 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium flex items-center gap-1.5 text-foreground">
                                <UploadCloud className="w-4 h-4 text-foreground" />
                                <span>Backup File (backup_file)</span>
                                {archType === "web_db" ? (
                                  <span className="text-xs text-red-500 font-bold">*</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground font-normal">(Tùy chọn)</span>
                                )}
                              </label>
                              <span className="text-xs text-muted-foreground font-mono">{currentDbConfig.acceptExtensions}</span>
                            </div>

                            {/* Hidden file input */}
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept={currentDbConfig.acceptExtensions}
                              onChange={handleFileInputChange}
                              className="hidden"
                              id="backupFileInput"
                            />

                            {!dbFile ? (
                              <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                                  isDragging
                                    ? "border-foreground bg-foreground/5 scale-[0.99]"
                                    : fileError
                                    ? "border-red-500/60 bg-red-500/5 hover:border-red-500"
                                    : "border-border hover:border-foreground/50 bg-background/50 hover:bg-muted/20"
                                }`}
                              >
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-2.5 ${currentDbConfig.iconBg}`}>
                                  <UploadCloud className="w-5 h-5" />
                                </div>
                                <p className="text-sm font-medium text-foreground">
                                  Bấm để chọn file hoặc kéo thả file vào đây
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {currentDbConfig.fileHint} {archType === "fullstack" && "(Để trống nếu muốn khởi tạo Database trắng)"}
                                </p>
                              </div>
                            ) : (
                              <div className="border border-border bg-muted/20 rounded-xl p-3.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${currentDbConfig.iconBg}`}>
                                    <FileCode className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{dbFile.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(dbFile.size / 1024).toFixed(1)} KB • {currentDbConfig.name} Backup File
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium px-2.5 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Ready
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleRemoveFile}
                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title="Remove file"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {fileError && (
                              <p className="text-xs text-red-400 flex items-center gap-1.5 font-medium mt-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {fileError}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 5. Submit Button */}
                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={
                      isDeploying ||
                      !appName ||
                      (archType === "fullstack"
                        ? !beRepoUrl.trim() || !feRepoUrl.trim()
                        : !repoUrl) ||
                      (archType === "web_db" && !dbFile) ||
                      (domainType === "custom" &&
                        (archType === "fullstack"
                          ? !beDomain.trim() || !feDomain.trim()
                          : archType === "monorepo"
                          ? !beDomain.trim()
                          : !customDomain))
                    }
                    className="w-full bg-foreground text-background px-4 py-2.5 rounded-md font-medium transition-all hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-xs"
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Deploying...</span>
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        <span>
                          {archType === "monorepo"
                            ? "🚀 Deploy Monorepo (Single Repo)"
                            : archType === "fullstack"
                            ? "🚀 Deploy Fullstack (2 Repos)"
                            : archType === "web_db"
                            ? "Deploy with Database"
                            : "Deploy Project"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="terminal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Terminal Window */}
            <div className="bg-[#000] border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
              <div className="bg-[#111] border-b border-border px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" />
                  Deployment Logs
                </div>
                <div className="w-10"></div>
              </div>
              
              <div 
                id="terminal-container"
                className="p-4 font-mono text-sm h-[400px] overflow-y-auto text-gray-300 scroll-smooth"
              >
                {logs.map((log, i) => (
                  <div key={i} className="mb-2 leading-relaxed whitespace-pre-wrap break-all">
                    {log.includes("✅") ? (
                      <span className="text-green-400 font-semibold">{log}</span>
                    ) : log.includes("❌") ? (
                      <span className="text-red-400 font-semibold">{log}</span>
                    ) : log.includes("🌐") ? (
                      <span className="text-blue-400">{log}</span>
                    ) : (
                      log
                    )}
                  </div>
                ))}
                {!deployResult && (
                  <div className="flex items-center gap-2 text-muted-foreground mt-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Building...</span>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            <AnimatePresence>
              {deployResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-4xl mx-auto w-full p-8 rounded-xl border flex flex-col items-center justify-center gap-4 text-center ${
                    deployResult.type === "success" 
                      ? "bg-green-500/5 border-green-500/20" 
                      : "bg-red-500/5 border-red-500/20"
                  }`}
                >
                  {deployResult.type === "success" ? (
                    <>
                      <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground">Deployment Complete</h3>
                      <p className="text-muted-foreground mb-4">Your application is now live and accessible on the web.</p>
                      <div className="flex gap-4">
                        <Link 
                          href="/"
                          className="px-6 py-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-md transition-colors text-sm font-medium"
                        >
                          Dashboard
                        </Link>
                        <a 
                          href={deployResult.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-6 py-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-md transition-colors text-sm font-medium flex items-center gap-2"
                        >
                          Visit Production
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold text-foreground">Deployment Failed</h3>
                      <p className="text-muted-foreground mb-4">{deployResult.text}</p>
                      <button 
                        onClick={() => {
                          if (logIntervalRef.current) {
                            clearInterval(logIntervalRef.current);
                            logIntervalRef.current = null;
                          }
                          setIsDeploying(false);
                          setLogs([]);
                          setCurrentDeploy(null);
                        }}
                        className="px-6 py-2.5 bg-background border border-border hover:bg-muted text-foreground rounded-md transition-colors text-sm font-medium"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
