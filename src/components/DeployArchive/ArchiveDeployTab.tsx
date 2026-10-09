"use client";

import { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FolderArchive,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  Globe,
  Loader2,
  Rocket,
  ShieldCheck,
  Info,
  Check,
  FileText,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AiProviderSelector } from "@/components/AiEngine/AiProviderSelector";
import { useAiProvider } from "@/lib/useAiProvider";

export type ArchiveDatabaseType = "mysql" | "postgresql" | "mongodb" | "mariadb";

export interface ArchiveDatabaseOption {
  id: ArchiveDatabaseType;
  name: string;
  tag: string;
  badgeColor: string;
  iconBg: string;
  description: string;
  acceptExtensions: string;
  fileHint: string;
}

export const ARCHIVE_DB_OPTIONS: ArchiveDatabaseOption[] = [
  {
    id: "mysql",
    name: "MySQL",
    tag: "RDBMS",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    description: "Cơ sở dữ liệu quan hệ tiêu chuẩn, tối ưu InnoDB engine",
    acceptExtensions: ".sql,.dump",
    fileHint: "File backup .sql hoặc .dump",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    tag: "SQL",
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    description: "Cơ sở dữ liệu quan hệ mạnh mẽ, hỗ trợ mở rộng cao",
    acceptExtensions: ".sql,.dump",
    fileHint: "File backup .sql hoặc .dump",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    tag: "NoSQL",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    description: "Cơ sở dữ liệu phi quan hệ Document NoSQL linh hoạt",
    acceptExtensions: ".json,.sql,.dump",
    fileHint: "File backup .json, .sql hoặc .dump",
  },
  {
    id: "mariadb",
    name: "MariaDB",
    tag: "RDBMS",
    badgeColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    iconBg: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    description: "Bản phân phối nguồn mở tốc độ cao tương thích MySQL",
    acceptExtensions: ".sql,.dump",
    fileHint: "File backup .sql hoặc .dump",
  },
];

const VALID_ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz", ".rar", ".7z"];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getArchiveExtension(name: string): string {
  const lower = name.toLowerCase();
  for (const ext of [".tar.gz", ".zip", ".tar", ".tgz", ".rar", ".7z"]) {
    if (lower.endsWith(ext)) return ext.toUpperCase().replace(".", "");
  }
  return "ARCHIVE";
}

function isValidArchive(name: string): boolean {
  const lower = name.toLowerCase();
  return VALID_ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface ArchiveDeployTabProps {
  onDeploySuccess: (deployedApp: {
    app_name: string;
    app_domain: string;
    repo_url: string;
    arch_type: string;
    db_type: ArchiveDatabaseType | null;
  }) => void;
}

export function ArchiveDeployTab({ onDeploySuccess }: ArchiveDeployTabProps) {
  // Archive File state
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [isDraggingArchive, setIsDraggingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  // App & Domain info
  const [appName, setAppName] = useState("");
  const [domainType, setDomainType] = useState<"system" | "custom">("system");
  const [systemSubdomain, setSystemSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [randomSubdomain] = useState(() => Math.random().toString(36).substring(2, 8));

  // Database toggle state
  const [withDatabase, setWithDatabase] = useState(false);
  const [selectedDb, setSelectedDb] = useState<ArchiveDatabaseType>("mysql");
  const [dbBackupFile, setDbBackupFile] = useState<File | null>(null);
  const [dbFileError, setDbFileError] = useState<string | null>(null);
  const [isDraggingDbFile, setIsDraggingDbFile] = useState(false);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  // Upload Progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [deployError, setDeployError] = useState<string | null>(null);

  // AI Provider state
  const { selectedProvider: selectedAiProvider, setProvider: setSelectedAiProvider } = useAiProvider();

  // Slugified app name
  const slugifiedName = appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const activeSubdomain = systemSubdomain.trim() || slugifiedName || randomSubdomain;
  const finalDomain =
    domainType === "system"
      ? (activeSubdomain ? `${activeSubdomain}.vibe.quyenlt.com` : "...")
      : customDomain.trim();

  const currentDbConfig =
    ARCHIVE_DB_OPTIONS.find((db) => db.id === selectedDb) || ARCHIVE_DB_OPTIONS[0];

  // Handle archive file drop/select
  const handleArchiveFileSelect = (file: File) => {
    if (!isValidArchive(file.name)) {
      setArchiveError(
        `Định dạng file không hợp lệ! Vui lòng chọn file nén: ${VALID_ARCHIVE_EXTENSIONS.join(", ")}`
      );
      return;
    }

    setArchiveFile(file);
    setArchiveError(null);

    // Tự động gợi ý app_name từ tên file nếu chưa có
    if (!appName) {
      let inferred = file.name;
      for (const ext of [".tar.gz", ".zip", ".tar", ".tgz", ".rar", ".7z"]) {
        if (inferred.toLowerCase().endsWith(ext)) {
          inferred = inferred.slice(0, -ext.length);
          break;
        }
      }
      const clean = inferred.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").toLowerCase();
      if (clean) {
        setAppName(clean);
        setSystemSubdomain(clean);
      }
    }
  };

  const handleArchiveDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingArchive(true);
  };

  const handleArchiveDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingArchive(false);
  };

  const handleArchiveDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingArchive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleArchiveFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveArchiveFile = () => {
    setArchiveFile(null);
    setArchiveError(null);
    if (archiveInputRef.current) archiveInputRef.current.value = "";
  };

  // Handle DB backup file drop/select
  const handleDbFileSelect = (file: File) => {
    const allowed = currentDbConfig.acceptExtensions
      .split(",")
      .map((e) => e.trim().toLowerCase());
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setDbFileError(
        `Chỉ chấp nhận file ${currentDbConfig.acceptExtensions} cho ${currentDbConfig.name}`
      );
      return;
    }
    setDbBackupFile(file);
    setDbFileError(null);
  };

  const handleRemoveDbFile = () => {
    setDbBackupFile(null);
    setDbFileError(null);
    if (dbFileInputRef.current) dbFileInputRef.current.value = "";
  };

  // Submit Deploy
  const handleSubmitDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeployError(null);

    if (!archiveFile) {
      setArchiveError("Vui lòng chọn hoặc kéo thả file nén mã nguồn.");
      return;
    }

    if (!slugifiedName) {
      setDeployError("Vui lòng nhập Tên định danh ứng dụng (app_name).");
      return;
    }

    if (domainType === "custom" && !customDomain.trim()) {
      setDeployError("Vui lòng nhập Tên miền tùy chỉnh (custom domain).");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedBytes(0);
    setTotalBytes(archiveFile.size);

    const formData = new FormData();
    formData.append("archive_file", archiveFile);
    formData.append("app_name", slugifiedName);
    formData.append("app_domain", finalDomain);
    formData.append("ai_provider", selectedAiProvider);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.quyenlt.com/api/deploy";
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, "");
    const targetUrl = withDatabase
      ? `${baseUrl}/api/deploy-archive-with-db`
      : `${baseUrl}/api/deploy-archive`;

    if (withDatabase) {
      formData.append("db_type", selectedDb);
      if (dbBackupFile) {
        formData.append("backup_file", dbBackupFile);
      }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", targetUrl);

        // Upload progress tracking
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(Math.round((event.loaded / event.total) * 100), 100);
            setUploadProgress(percent);
            setUploadedBytes(event.loaded);
            setTotalBytes(event.total);
          }
        };

        xhr.onload = () => {
          let data: any = null;
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            data = null;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            if (data && (data.status === "error" || data.status === "failed")) {
              reject(
                new Error(
                  data.detail || data.message || "Máy chủ phản hồi lỗi khi xử lý file nén"
                )
              );
            } else {
              resolve();
            }
          } else {
            reject(
              new Error(
                data?.detail ||
                  data?.message ||
                  `Lỗi máy chủ (${xhr.status}): ${xhr.statusText || "Không rõ nguyên nhân"}`
              )
            );
          }
        };

        xhr.onerror = () => {
          reject(
            new Error("Lỗi mạng khi tải file lên máy chủ. Vui lòng kiểm tra lại kết nối.")
          );
        };

        xhr.send(formData);
      });

      // Upload and backend acceptance successful -> Trigger real-time logs modal
      onDeploySuccess({
        app_name: slugifiedName,
        app_domain: finalDomain,
        repo_url: `archive:${archiveFile.name}`,
        arch_type: withDatabase ? "archive_db" : "archive",
        db_type: withDatabase ? selectedDb : null,
      });
    } catch (err: any) {
      console.error("Deploy archive error:", err);
      setDeployError(err?.message || "Có lỗi xảy ra khi tải lên và triển khai file nén.");
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmitDeploy} className="flex flex-col lg:flex-row gap-8 items-start">
      {/* CỘT TRÁI: KHU VỰC TẢI FILE (DROPZONE) & HƯỚNG DẪN */}
      <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 lg:sticky lg:top-8 flex flex-col gap-5">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <FolderArchive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-foreground">
                  Tải lên Mã nguồn (Archive Dropzone)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ các định dạng file nén phổ biến (.zip, .tar, .tar.gz, .tgz, .rar, .7z)
                </p>
              </div>
            </div>
            {archiveFile && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                {getArchiveExtension(archiveFile.name)}
              </span>
            )}
          </div>

          {/* DROPZONE KHU VỰC KÉO THẢ */}
          <input
            ref={archiveInputRef}
            type="file"
            accept=".zip,.tar,.tar.gz,.tgz,.rar,.7z"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleArchiveFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          {!archiveFile ? (
            <div
              onDragOver={handleArchiveDragOver}
              onDragLeave={handleArchiveDragLeave}
              onDrop={handleArchiveDrop}
              onClick={() => archiveInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDraggingArchive
                  ? "border-amber-500 bg-amber-500/10 scale-[1.01]"
                  : "border-border hover:border-amber-500/60 hover:bg-muted/30 bg-muted/10"
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8" />
              </div>

              <p className="text-sm font-semibold text-foreground">
                Kéo thả file nén mã nguồn vào đây
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                hoặc <span className="text-amber-400 underline font-medium">duyệt từ máy tính của bạn</span> để tải lên
              </p>

              {/* Badges định dạng file */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5">
                {VALID_ARCHIVE_EXTENSIONS.map((ext) => (
                  <span
                    key={ext}
                    className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
                  >
                    {ext}
                  </span>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground/70 mt-3 flex items-center justify-center gap-1.5 flex-wrap">
                <span>Tối ưu cho Vibe Coding &amp; mã nguồn từ <strong className="text-amber-400/90 font-medium">aistudio.google.com</strong></span>
                <span>•</span>
                <span>Tối đa: 200MB</span>
              </p>
            </div>
          ) : (
            /* FILE ĐÃ CHỌN */
            <div className="border border-border bg-muted/20 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate" title={archiveFile.name}>
                      {archiveFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{formatBytes(archiveFile.size)}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px] uppercase text-amber-400 font-semibold">
                        {getArchiveExtension(archiveFile.name)}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveArchiveFile}
                  disabled={isUploading}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title="Xóa file đã chọn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  File sẵn sàng triển khai
                </span>
                <button
                  type="button"
                  onClick={() => archiveInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-amber-400 hover:underline text-xs"
                >
                  Đổi file khác
                </button>
              </div>
            </div>
          )}

          {archiveError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {archiveError}
            </p>
          )}
        </div>

        {/* HƯỚNG DẪN & BEST PRACTICES */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Mẹo đóng gói &amp; Chuẩn Vibe Coding (aistudio.google.com):</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside leading-relaxed">
            <li>
              <strong>Cấu trúc thư mục:</strong> Nén trực tiếp các file từ thư mục gốc của project (chứa <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">package.json</code>, <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">requirements.txt</code>, <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">go.mod</code>, hoặc <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">Dockerfile</code>).
            </li>
            <li>
              <strong>Tối ưu dung lượng:</strong> Vui lòng loại bỏ thư mục <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">node_modules</code>, <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">.git</code>, <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">dist</code> hoặc <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">.next</code> trước khi nén để quá trình tải lên nhanh hơn.
            </li>
            <li>
              <strong>Chuẩn Vibe aistudio.google.com:</strong> Tương thích hoàn hảo với mã nguồn xuất từ <span className="text-foreground font-medium underline decoration-amber-400/40 underline-offset-2">Google AI Studio</span>, Gemini Apps, React/Vite, Next.js, Python (FastAPI/Streamlit) hoặc Node.js. Hệ thống tự động nhận diện runtime và khởi chạy tức thì mà không cần cấu hình phức tạp.
            </li>
            <li>
              <strong>Biến môi trường AI (Gemini):</strong> Đối với ứng dụng gọi Gemini API, bạn có thể dễ dàng cấu hình biến môi trường <code className="text-foreground bg-muted px-1 py-0.5 rounded text-[11px]">GEMINI_API_KEY</code> trong mục Cài đặt dự án sau khi deploy.
            </li>
          </ul>
        </div>
      </div>

      {/* CỘT PHẢI: FORM CẤU HÌNH THÔNG TIN DỰ ÁN & DATABASE */}
      <div className="w-full flex-1 min-w-0">
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col gap-6">
          {/* 1. TÊN ỨNG DỤNG */}
          <div className="flex flex-col gap-2">
            <label htmlFor="archiveAppName" className="text-sm font-medium flex items-center justify-between">
              <span>Tên ứng dụng (Project Name)</span>
              <span className="text-[11px] text-muted-foreground">app_name</span>
            </label>
            <input
              id="archiveAppName"
              type="text"
              placeholder="vd: my-portfolio"
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all text-sm"
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value);
                setSystemSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              required
              disabled={isUploading}
            />
            {slugifiedName && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                <span>Định danh K8s:</span>
                <span className="text-foreground font-semibold">{slugifiedName}</span>
              </p>
            )}
          </div>

          {/* 2. CẤU HÌNH DOMAIN */}
          <div className="flex flex-col gap-3 pt-4 border-t border-border">
            <label className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-foreground" />
                Tên miền truy cập (Domain)
              </span>
              <span className="text-[11px] text-muted-foreground">app_domain</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDomainType("system")}
                disabled={isUploading}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  domainType === "system"
                    ? "border-foreground bg-foreground/5 text-foreground shadow-xs"
                    : "border-border text-muted-foreground hover:border-foreground/50"
                }`}
              >
                Subdomain Hệ thống
              </button>
              <button
                type="button"
                onClick={() => setDomainType("custom")}
                disabled={isUploading}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  domainType === "custom"
                    ? "border-foreground bg-foreground/5 text-foreground shadow-xs"
                    : "border-border text-muted-foreground hover:border-foreground/50"
                }`}
              >
                Tên miền riêng (Custom)
              </button>
            </div>

            {domainType === "system" ? (
              <div className="flex items-center">
                <input
                  type="text"
                  placeholder="my-portfolio"
                  value={systemSubdomain}
                  onChange={(e) =>
                    setSystemSubdomain(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  disabled={isUploading}
                  className="w-full bg-background border border-border border-r-0 rounded-l-lg px-3.5 py-2.5 outline-none focus:border-foreground transition-all text-xs font-mono"
                />
                <div className="bg-muted px-3.5 py-2.5 border border-border rounded-r-lg text-muted-foreground text-xs font-mono flex items-center justify-center shrink-0">
                  .vibe.quyenlt.com
                </div>
              </div>
            ) : (
              <input
                type="text"
                placeholder="my-app.yourdomain.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                disabled={isUploading}
                className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 outline-none focus:border-foreground transition-all text-xs font-mono"
              />
            )}

            <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
              <span>Đường dẫn dự kiến:</span>
              <span className="text-emerald-400 font-medium">https://{finalDomain}</span>
            </p>
          </div>

          {/* 3. TOGGLE SWITCH: CẤP PHÁT DATABASE NỘI BỘ */}
          <div className="pt-4 border-t border-border flex flex-col gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <label htmlFor="dbToggle" className="text-xs font-semibold text-foreground cursor-pointer block">
                    Cấp phát Database nội bộ?
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Khởi tạo riêng một container DB trên cụm K3s cùng ứng dụng
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  id="dbToggle"
                  type="checkbox"
                  checked={withDatabase}
                  onChange={(e) => setWithDatabase(e.target.checked)}
                  disabled={isUploading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* CẤU HÌNH DATABASE KHI TOGGLE BẬT */}
            <AnimatePresence>
              {withDatabase && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Select Box Database Types */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Loại cơ sở dữ liệu (db_type):</span>
                      <span className="text-[11px] text-muted-foreground">MySQL, PostgreSQL, MongoDB, MariaDB</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      {ARCHIVE_DB_OPTIONS.map((db) => {
                        const isSelected = selectedDb === db.id;
                        return (
                          <button
                            key={db.id}
                            type="button"
                            onClick={() => {
                              setSelectedDb(db.id);
                              setDbFileError(null);
                            }}
                            disabled={isUploading}
                            className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/30"
                                : "border-border bg-background hover:border-indigo-500/40 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-indigo-400" />
                                {db.name}
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${db.badgeColor}`}>
                                {db.tag}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">
                              {db.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Backup SQL / Dump File Input (Tùy chọn) */}
                  <div className="space-y-2 pt-2">
                    <input
                      ref={dbFileInputRef}
                      type="file"
                      accept={currentDbConfig.acceptExtensions}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleDbFileSelect(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />

                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>File khởi tạo dữ liệu / Backup (Tùy chọn)</span>
                      <span className="text-[10px] text-muted-foreground">{currentDbConfig.acceptExtensions}</span>
                    </label>

                    {!dbBackupFile ? (
                      <div
                        onClick={() => dbFileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingDbFile(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDraggingDbFile(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingDbFile(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleDbFileSelect(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-all ${
                          isDraggingDbFile
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-border hover:border-indigo-500/50 bg-background/50"
                        }`}
                      >
                        <p className="text-xs text-foreground font-medium flex items-center justify-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Chọn file backup {currentDbConfig.name}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          (Để trống nếu muốn khởi tạo Database trắng không có dữ liệu)
                        </p>
                      </div>
                    ) : (
                      <div className="border border-border bg-muted/20 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${currentDbConfig.iconBg}`}>
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {dbBackupFile.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatBytes(dbBackupFile.size)} • Backup {currentDbConfig.name}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleRemoveDbFile}
                          disabled={isUploading}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {dbFileError && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {dbFileError}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 4. THANH TIẾN TRÌNH UPLOAD (UPLOAD PROGRESS) */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-2 text-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>
                      {uploadProgress < 100
                        ? "Đang tải file nén lên máy chủ..."
                        : "Tải file hoàn tất! Đang giải nén & khởi tạo K3s..."}
                    </span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{uploadProgress}%</span>
                </div>

                {/* Progress bar track */}
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>
                    {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
                  </span>
                  <span>{archiveFile ? archiveFile.name : ""}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deploy Error Message */}
          {deployError && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deployError}</span>
            </div>
          )}

          {/* AI Engine Selector */}
          <AiProviderSelector
            variant="cards"
            value={selectedAiProvider}
            onChange={setSelectedAiProvider}
          />

          {/* 5. NÚT SUBMIT DEPLOY */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isUploading ||
                !archiveFile ||
                !slugifiedName ||
                (domainType === "custom" && !customDomain.trim())
              }
              className="w-full bg-foreground text-background px-4 py-3 rounded-lg font-semibold transition-all hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tải lên &amp; chuẩn bị K3s ({uploadProgress}%)...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>
                    {withDatabase
                      ? `🚀 Triển khai File nén + ${currentDbConfig.name}`
                      : "🚀 Bắt đầu Triển khai từ File nén"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
