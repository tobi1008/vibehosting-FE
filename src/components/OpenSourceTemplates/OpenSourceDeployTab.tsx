"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Globe,
  Database,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Rocket,
  Lock,
  ShieldCheck,
  RefreshCw,
  Code2,
  Search,
  Check,
  Zap,
  HardDrive,
  Layers,
  ChevronDown,
  Info,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AiProviderSelector } from "@/components/AiEngine/AiProviderSelector";
import { useAiProvider } from "@/lib/useAiProvider";
import {
  OpenSourceTemplate,
  DEFAULT_OPEN_SOURCE_TEMPLATES,
} from "@/app/api/open-source-templates/route";
import Link from "next/link";

export interface OpenSourceDeployTabProps {
  onDeploySuccess: (deployedApp: {
    app_name: string;
    app_domain: string;
    repo_url: string;
    arch_type: string;
    db_type: string | null;
  }) => void;
  initialTemplateId?: string;
}

type DatabaseType = "mysql" | "mariadb" | "postgresql" | "mongodb";

interface DatabaseOption {
  id: DatabaseType;
  name: string;
  tag: string;
  badgeColor: string;
  iconBg: string;
  description: string;
}

const CLEAN_DB_OPTIONS: DatabaseOption[] = [
  {
    id: "mysql",
    name: "MySQL 8.0",
    tag: "RDBMS",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    description: "Cơ sở dữ liệu quan hệ tiêu chuẩn, tối ưu WordPress, Laravel & Ghost",
  },
  {
    id: "mariadb",
    name: "MariaDB",
    tag: "RDBMS",
    badgeColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    description: "Bản phân phối mã nguồn mở hiệu năng cao, tương thích 100% MySQL",
  },
  {
    id: "postgresql",
    name: "PostgreSQL 16",
    tag: "SQL",
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    description: "Hệ quản trị CSDL quan hệ tiên tiến, tối ưu ứng dụng enterprise & Node.js",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    tag: "NoSQL",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    description: "Cơ sở dữ liệu NoSQL dạng tài liệu linh hoạt",
  },
];

// Helper icons cho các mẫu CMS phổ biến
function TemplateBrandIcon({ id, className = "w-5 h-5" }: { id: string; className?: string }) {
  if (id === "wordpress") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.636 7.855 6.356 9.312L4.62 9.472C5.352 7.393 7.324 5.86 9.684 5.86c1.19 0 2.292.385 3.19 1.042l-7.39 12.87C7.362 21.26 9.57 22 12 22c3.27 0 6.19-1.572 8.02-4.004l-3.92-10.74c.48-.22.95-.356 1.45-.356.57 0 1.13.13 1.62.39L15.34 19.34C19.26 17.9 22 14.26 22 12c0-5.523-4.477-10-10-10zm-1.84 8.78c.38-.02.73-.04 1.04-.04.4 0 .79.02 1.16.06l2.12 6.36-1.5 4.38-2.82-10.76zm4.98 6.04l2.16-6.02c.42-.04.81-.06 1.16-.06.28 0 .58.02.88.06l-2.02 5.92-2.18.1z" />
      </svg>
    );
  }
  if (id === "laravel") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.5 7.2l-9.2-5.1c-.2-.1-.5-.1-.7 0L2.5 7.2c-.3.2-.5.5-.5.8v10c0 .3.2.6.5.8l9.2 5.1c.1.1.2.1.3.1.1 0 .2 0 .3-.1l9.2-5.1c.3-.2.5-.5.5-.8V8c0-.3-.2-.6-.5-.8zM12 3.8l7.5 4.2-3.1 1.7-7.5-4.2L12 3.8zm-1 6.8l7.5 4.2-3.1 1.7-7.5-4.2 3.1-1.7zm-7 5.7V8.9l6 3.3v7.3l-6-3.8zm8 3.8v-7.3l3-1.7v7.3l-3 1.7zm8-3.8l-3 1.7v-7.3l3-1.7v7.3z" />
      </svg>
    );
  }
  if (id === "ghost") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12c0 3.84 2.16 7.18 5.34 8.87.12-.34.25-.68.4-1.02-.27-.14-.54-.3-.8-.47C4.65 17.65 3.5 15 3.5 12c0-4.69 3.81-8.5 8.5-8.5s8.5 3.81 8.5 8.5c0 2.99-1.15 5.65-3.44 7.38-.26.17-.53.33-.8.47.15.34.28.68.4 1.02C19.84 19.18 22 15.84 22 12c0-5.52-4.48-10-10-10zm-3 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
      </svg>
    );
  }
  return <Sparkles className={className} />;
}

export function OpenSourceDeployTab({
  onDeploySuccess,
  initialTemplateId = "wordpress",
}: OpenSourceDeployTabProps) {
  const { selectedProvider: selectedAiProvider, setProvider: setSelectedAiProvider } =
    useAiProvider();

  // Danh sách template
  const [templates, setTemplates] = useState<OpenSourceTemplate[]>(DEFAULT_OPEN_SOURCE_TEMPLATES);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);

  // Form states
  const [appName, setAppName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [domainType, setDomainType] = useState<"system" | "custom">("system");
  const [systemSubdomain, setSystemSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [selectedDb, setSelectedDb] = useState<DatabaseType>("mysql");

  // Private repo state (cho Custom)
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);
  const [githubToken, setGithubToken] = useState("");

  // Submit states
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Lấy danh sách template từ backend
  useEffect(() => {
    let isMounted = true;
    async function loadTemplates() {
      try {
        setLoadingTemplates(true);
        const res = await fetch("/api/open-source-templates");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.templates && Array.isArray(data.templates)) {
            setTemplates(data.templates);
          }
        }
      } catch (err) {
        console.warn("Could not load templates from API, using defaults", err);
      } finally {
        if (isMounted) setLoadingTemplates(false);
      }
    }
    loadTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

  // Template đang chọn
  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) ||
    templates[0] ||
    DEFAULT_OPEN_SOURCE_TEMPLATES[0];

  // Khi chọn template mới, tự động điền gợi ý
  useEffect(() => {
    if (activeTemplate) {
      if (activeTemplate.id !== "custom") {
        setRepoUrl(activeTemplate.default_repo);
        if (!appName || appName === "my-wordpress" || appName === "my-laravel" || appName === "my-ghost") {
          const defaultName = `my-${activeTemplate.id}`;
          setAppName(defaultName);
          setSystemSubdomain(defaultName);
        }
      } else {
        if (!repoUrl || repoUrl.includes("WordPress") || repoUrl.includes("laravel") || repoUrl.includes("Ghost")) {
          setRepoUrl("");
        }
        if (!appName) {
          setAppName("my-opensource-app");
          setSystemSubdomain("my-opensource-app");
        }
      }

      if (activeTemplate.default_db) {
        setSelectedDb(activeTemplate.default_db as DatabaseType);
      }
    }
  }, [selectedTemplateId]);

  // Slugify appName
  const slugifiedName = appName.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const finalSubdomain = systemSubdomain || slugifiedName || "my-app";
  const finalDomain =
    domainType === "system" ? `${finalSubdomain}.vibe.quyenlt.com` : customDomain;

  // Lọc template theo search
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmitDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeployError(null);

    if (!slugifiedName) {
      setDeployError("Vui lòng nhập tên ứng dụng hợp lệ.");
      return;
    }

    if (!repoUrl.trim()) {
      setDeployError("Vui lòng cung cấp GitHub Repository URL.");
      return;
    }

    if (domainType === "custom" && !customDomain.trim()) {
      setDeployError("Vui lòng nhập tên miền riêng (vd: blog.example.com).");
      return;
    }

    setIsDeploying(true);

    try {
      const formData = new FormData();
      formData.append("app_name", slugifiedName);
      formData.append("app_domain", finalDomain);
      formData.append("repo_url", repoUrl.trim());
      formData.append("db_type", selectedDb);
      formData.append("ai_provider", selectedAiProvider);
      formData.append("template_id", activeTemplate.id);
      formData.append("is_clean_db", "true");

      if (isPrivateRepo && githubToken.trim()) {
        formData.append("github_token", githubToken.trim());
      }

      // Gửi yêu cầu triển khai đến /api/deploy-with-db
      const res = await fetch("/api/deploy-with-db", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.status !== "error" && data?.status !== "failed") {
        onDeploySuccess({
          app_name: slugifiedName,
          app_domain: finalDomain,
          repo_url: repoUrl.trim(),
          arch_type: "web_db",
          db_type: selectedDb,
        });
      } else {
        const errMsg =
          data?.detail ||
          data?.message ||
          `Máy chủ phản hồi lỗi (${res.status}): ${res.statusText || "Không rõ nguyên nhân"}`;
        setDeployError(errMsg);
        setIsDeploying(false);
      }
    } catch (err: any) {
      console.error("Deploy open-source template error:", err);
      setDeployError(err?.message || "Lỗi kết nối khi gửi yêu cầu triển khai.");
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
      {/* =========================================================================
          CỘT TRÁI (STICKY SIDEBAR): BỘ SƯU TẬP MẪU CMS & CLEAN DB HIGHLIGHT
          ========================================================================= */}
      <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 lg:sticky lg:top-8 flex flex-col gap-4">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[580px] max-h-[820px]">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-foreground">
                  Mẫu Ứng dụng &amp; CMS
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Triển khai Clean DB 1-Click
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
              {templates.length} TEMPLATES
            </span>
          </div>

          {/* Search bar */}
          <div className="p-3 border-b border-border bg-background">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm WordPress, Laravel, Ghost..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Clean DB Notice Banner */}
          <div className="p-3 mx-3 mt-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-foreground font-semibold block">
                Cơ chế Clean Database 1-Click
              </span>
              Khởi tạo Database trắng tinh, tự sinh mật khẩu an toàn và tiêm trực tiếp biến môi trường mà{" "}
              <strong className="text-purple-300">không cần tải lên file backup SQL</strong>.
            </div>
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {loadingTemplates ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tải danh sách mẫu...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs text-center p-4">
                <p>Không tìm thấy mẫu phù hợp với từ khóa "{searchQuery}".</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-purple-400 hover:underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                      isSelected
                        ? "border-purple-500/70 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30"
                        : "border-border/80 bg-card/60 hover:border-purple-500/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-500"
                              : "bg-muted text-foreground border-border"
                          }`}
                        >
                          <TemplateBrandIcon id={template.id} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {template.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {template.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${
                            isSelected
                              ? "bg-purple-500/30 text-purple-200 border-purple-500/40"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {template.badge}
                        </span>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground">
                      <span className="font-mono">
                        DB: <strong className="text-foreground uppercase">{template.default_db}</strong>
                      </span>
                      {isSelected ? (
                        <span className="text-purple-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Đang chọn
                        </span>
                      ) : (
                        <span className="hover:text-foreground">Chọn mẫu →</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CỘT PHẢI: FORM CẤU HÌNH THÔNG TIN DỰ ÁN, DATABASE & AI ENGINE
          ========================================================================= */}
      <div className="w-full flex-1 min-w-0">
        <form
          onSubmit={handleSubmitDeploy}
          className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col gap-6"
        >
          {/* Active Template Hero Banner */}
          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <TemplateBrandIcon id={activeTemplate.id} className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    {activeTemplate.name}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {activeTemplate.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTemplate.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-background border border-border text-foreground font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                {activeTemplate.default_db.toUpperCase()} (Clean)
              </span>
            </div>
          </div>

          {/* 1. PROJECT NAME */}
          <div className="flex flex-col gap-2">
            <label htmlFor="templateAppName" className="text-sm font-medium flex items-center justify-between">
              <span>Tên ứng dụng (Project Name)</span>
              <span className="text-xs text-muted-foreground font-mono">app_name</span>
            </label>
            <input
              id="templateAppName"
              type="text"
              placeholder="vd: my-awesome-blog"
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value);
                setSystemSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              required
              disabled={isDeploying}
            />
            {appName && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                <span>Định danh Kubernetes:</span>
                <span className="text-foreground font-semibold">{slugifiedName}</span>
              </p>
            )}
          </div>

          {/* 2. REPOSITORY CONFIGURATION */}
          <div className="flex flex-col gap-2 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label htmlFor="templateRepoUrl" className="text-sm font-medium flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-purple-400" />
                <span>GitHub Repository URL (repo_url)</span>
                <span className="text-red-500 font-bold">*</span>
              </label>
              {activeTemplate.id !== "custom" && (
                <span className="text-[11px] text-muted-foreground">
                  Repo chính thức (Có thể chỉnh sửa nếu fork)
                </span>
              )}
            </div>

            <input
              id="templateRepoUrl"
              type="url"
              placeholder="https://github.com/WordPress/WordPress.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-xs font-mono"
              required
              disabled={isDeploying}
            />

            {/* Private repo option for custom */}
            {activeTemplate.id === "custom" && (
              <div className="flex flex-col gap-2 mt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPrivateRepo}
                    onChange={(e) => setIsPrivateRepo(e.target.checked)}
                    className="rounded border-border accent-purple-500"
                  />
                  <span className="text-xs text-muted-foreground">
                    Đây là Repository riêng tư (Private Repo)?
                  </span>
                </label>

                {isPrivateRepo && (
                  <input
                    type="password"
                    placeholder="Nhập GitHub Personal Access Token (ghp_...)"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-purple-500"
                  />
                )}
              </div>
            )}
          </div>

          {/* 3. DOMAIN CONFIGURATION */}
          <div className="flex flex-col gap-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-foreground" />
                <span>Cấu hình Tên miền (Domain)</span>
              </label>
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setDomainType("system")}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    domainType === "system"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  System Subdomain
                </button>
                <button
                  type="button"
                  onClick={() => setDomainType("custom")}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    domainType === "custom"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tên miền riêng
                </button>
              </div>
            </div>

            {domainType === "system" ? (
              <div className="flex items-center">
                <input
                  type="text"
                  placeholder="my-blog"
                  value={systemSubdomain}
                  onChange={(e) =>
                    setSystemSubdomain(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  disabled={isDeploying}
                  className="w-full bg-background border border-border border-r-0 rounded-l-lg px-3.5 py-2.5 outline-none focus:border-purple-500 transition-all text-xs font-mono"
                />
                <div className="bg-muted px-3.5 py-2.5 border border-border rounded-r-lg text-muted-foreground text-xs font-mono flex items-center justify-center shrink-0">
                  .vibe.quyenlt.com
                </div>
              </div>
            ) : (
              <input
                type="text"
                placeholder="vd: blog.quyenlt.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                disabled={isDeploying}
                className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 outline-none focus:border-purple-500 transition-all text-xs font-mono"
                required
              />
            )}

            <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Domain truy cập:</span>
              <span className="text-purple-400 font-semibold">https://{finalDomain}</span>
            </div>
          </div>

          {/* 4. CLEAN DATABASE SELECTION */}
          <div className="flex flex-col gap-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label htmlFor="templateDbSelect" className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Loại Database trắng (Clean Database)</span>
              </label>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                KHÔNG CẦN SQL FILE
              </span>
            </div>

            <div className="relative">
              <select
                id="templateDbSelect"
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value as DatabaseType)}
                className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer text-foreground appearance-none font-medium pr-10"
                disabled={isDeploying}
              >
                {CLEAN_DB_OPTIONS.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.name} - {db.description}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Clean DB Features List */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-semibold text-foreground text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Quy trình cấp phát tự động của Vibe Hosting:</span>
              </div>
              <ul className="text-muted-foreground space-y-1 text-[11px] list-disc list-inside leading-relaxed">
                <li>
                  Khởi tạo một Pod StatefulSet Database riêng biệt với Persistent Volume SSD riêng.
                </li>
                <li>
                  Tự động sinh tài khoản và tiêm trực tiếp biến <code className="text-foreground bg-muted px-1 py-0.2 rounded font-mono">DB_HOST</code>, <code className="text-foreground bg-muted px-1 py-0.2 rounded font-mono">DB_USER</code>, <code className="text-foreground bg-muted px-1 py-0.2 rounded font-mono">DB_PASSWORD</code>, <code className="text-foreground bg-muted px-1 py-0.2 rounded font-mono">DB_DATABASE</code> vào ứng dụng.
                </li>
                <li>
                  Đối với WordPress: Tự sinh 8 Authentication Salts ngẫu nhiên và cấu hình SSL Reverse Proxy.
                </li>
              </ul>
            </div>
          </div>

          {/* 5. AI ENGINE SELECTION */}
          <AiProviderSelector
            variant="cards"
            value={selectedAiProvider}
            onChange={setSelectedAiProvider}
            title="AI Engine Triển khai &amp; Phân tích"
            subtitle="Chọn bộ não AI hỗ trợ quét cấu hình, sinh container specs và tối ưu hóa runtime"
          />

          {/* Error Message */}
          {deployError && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deployError}</span>
            </div>
          )}

          {/* 6. SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isDeploying || !appName.trim() || !repoUrl.trim()}
              className="w-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang khởi tạo {activeTemplate.name}...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>
                    Khởi chạy 1-Click: {activeTemplate.name} (Clean DB)
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
