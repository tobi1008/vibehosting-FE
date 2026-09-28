'use client';

import { useState, useEffect, useRef, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useProjects } from '@/lib/ProjectContext';
import { ProjectCicdSettings } from '@/components/ProjectCicdSettings';
import { extractCurrentSessionLines } from '@/lib/deployment';
import { CodeEditorTab } from '@/components/FileManager/CodeEditorTab';
import { AiDebugTab } from '@/components/AiDebug/AiDebugTab';
import { DeployHistoryTab } from '@/components/DeployHistory/DeployHistoryTab';
import {
  ArrowLeft,
  GitBranch,
  ExternalLink,
  Terminal,
  Sliders,
  Activity,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
  Cpu,
  Copy,
  Check,
  Pause,
  Play,
  ArrowDown,
  Search,
  RefreshCw,
  Layers,
  Box,
  Sparkles,
  Edit3,
  Code2,
  History,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type TabType = 'code-editor' | 'ai-debug' | 'deploy-history' | 'runtime-logs' | 'build-logs' | 'settings' | 'overview';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const resolvedParams = use(params);
  const appName = decodeURIComponent(resolvedParams.name);

  const { data: session, status } = useSession();
  const router = useRouter();
  const { projects } = useProjects();

  const [activeTab, setActiveTab] = useState<TabType>('runtime-logs');

  // Build Logs state
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildSearch, setBuildSearch] = useState('');
  const [buildAutoScroll, setBuildAutoScroll] = useState(true);
  const buildLogsEndRef = useRef<HTMLDivElement>(null);

  // Runtime Logs state
  const [targetAppName, setTargetAppName] = useState<string>(appName);
  const [isCustomizingPod, setIsCustomizingPod] = useState(false);
  const [customInput, setCustomInput] = useState<string>(appName);
  const [isRefreshingPod, setIsRefreshingPod] = useState(false);
  const [detectedPodSuggestion, setDetectedPodSuggestion] = useState<string | null>(null);

  const [podLogs, setPodLogs] = useState<string[]>([]);
  const [podName, setPodName] = useState<string | null>(null);
  const [podStatus, setPodStatus] = useState<'loading' | 'running' | 'not_found' | 'error'>('loading');
  const [podWarningMsg, setPodWarningMsg] = useState<string | null>(null);
  const [linesCount, setLinesCount] = useState<number>(200);
  const [podComponent, setPodComponent] = useState<'all' | 'be' | 'fe'>('all');
  const [podSearch, setPodSearch] = useState('');
  const [podAutoScroll, setPodAutoScroll] = useState(true);
  const [isPodPaused, setIsPodPaused] = useState(false);
  const [copiedPodName, setCopiedPodName] = useState(false);
  const [copiedAllLogs, setCopiedAllLogs] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const podLogsEndRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p) => p.app_name === appName || p.app_name === targetAppName);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync target when appName route parameter changes or restore saved override
  useEffect(() => {
    try {
      const savedOverride = localStorage.getItem(`vibe_pod_override_${appName}`);
      if (savedOverride) {
        setTargetAppName(savedOverride);
        setCustomInput(savedOverride);
        return;
      }
    } catch {}
    setTargetAppName(appName);
    setCustomInput(appName);
  }, [appName]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // 1. Fetch Build Logs (/api/logs/{app_name})
  useEffect(() => {
    if (activeTab !== 'build-logs') return;

    let isSubscribed = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const fetchBuildLogs = async () => {
      try {
        const queryName = targetAppName || appName;
        const res = await fetch(`/api/logs/${encodeURIComponent(queryName)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isSubscribed && data.logs) {
          const { sessionLines } = extractCurrentSessionLines(data.logs);
          const rawLines = sessionLines.length > 0 ? sessionLines : data.logs.split('\n').filter((l: string) => l.trim().length > 0);
          const displayLines = rawLines.length > 500 ? rawLines.slice(-500) : rawLines;
          setBuildLogs(displayLines.map((l: string) => (l.startsWith('>') ? l : `> ${l}`)));
        }
      } catch (e) {
        console.error('Error fetching build logs:', e);
      }
    };

    fetchBuildLogs();
    const interval = setInterval(fetchBuildLogs, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeTab, appName, targetAppName]);

  // Auto-scroll build logs
  useEffect(() => {
    if (activeTab === 'build-logs' && buildAutoScroll) {
      buildLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [buildLogs, activeTab, buildAutoScroll]);

  // Scan available active pods in K8s to suggest / auto-recover
  const scanAvailablePods = async (baseName: string): Promise<string | null> => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const candidates = Array.from(
      new Set([
        baseName,
        `${baseName}-fe`,
        `${baseName}-be`,
        baseName.replace(/-(fe|be)$/, ''),
        appName,
        `${appName}-fe`,
        `${appName}-be`,
      ])
    ).filter(Boolean);

    for (const cand of candidates) {
      try {
        const [resBe, resFe, resDirect] = await Promise.all([
          fetch(`/api/pod-logs/${encodeURIComponent(cand)}?lines=10&component=be`),
          fetch(`/api/pod-logs/${encodeURIComponent(cand)}?lines=10&component=fe`),
          fetch(`/api/pod-logs/${encodeURIComponent(cand)}?lines=10`),
        ]);

        const [dataBe, dataFe, dataDirect] = await Promise.all([
          resBe.ok ? resBe.json() : null,
          resFe.ok ? resFe.json() : null,
          resDirect.ok ? resDirect.json() : null,
        ]);

        if (
          (dataBe?.status === 'success' && dataBe?.pod_name) ||
          (dataFe?.status === 'success' && dataFe?.pod_name) ||
          (dataDirect?.status === 'success' && dataDirect?.pod_name)
        ) {
          return cand;
        }
      } catch (e) {
        // ignore probe errors
      }
    }
    return null;
  };

  // 2. Fetch Runtime Pod Logs (/api/pod-logs/{app_name}?lines=...&component=...)
  const fetchPodLogs = async (overrideName?: string): Promise<boolean> => {
    if (isPodPaused && !overrideName) return false;
    const nameToUse = (overrideName || targetAppName || appName).trim();
    if (!nameToUse) return false;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://116.118.50.199:8080/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    try {
      const isFullstack = project?.arch_type === 'fullstack' || project?.arch_type === 'monorepo';

      if (isFullstack && podComponent === 'all') {
        const [resBe, resFe] = await Promise.all([
          fetch(`/api/pod-logs/${encodeURIComponent(nameToUse)}?lines=${linesCount}&component=be`),
          fetch(`/api/pod-logs/${encodeURIComponent(nameToUse)}?lines=${linesCount}&component=fe`),
        ]);
        const dataBe = resBe.ok ? await resBe.json() : null;
        const dataFe = resFe.ok ? await resFe.json() : null;

        let mergedLogs: string[] = [];
        let foundAny = false;
        let podNames: string[] = [];

        if (dataBe?.status === 'success' && dataBe.logs) {
          foundAny = true;
          if (dataBe.pod_name) podNames.push(`BE: ${dataBe.pod_name}`);
          const beLines = dataBe.logs.split('\n').map((l: string) => `[BE] ${l}`);
          mergedLogs = [...mergedLogs, ...beLines];
        }
        if (dataFe?.status === 'success' && dataFe.logs) {
          foundAny = true;
          if (dataFe.pod_name) podNames.push(`FE: ${dataFe.pod_name}`);
          const feLines = dataFe.logs.split('\n').map((l: string) => `[FE] ${l}`);
          mergedLogs = [...mergedLogs, ...feLines];
        }

        if (foundAny) {
          setPodStatus('running');
          setPodName(podNames.join(' | '));
          setPodLogs(mergedLogs);
          setPodWarningMsg(null);
          return true;
        } else {
          setPodStatus('not_found');
          setPodName(null);
          setPodWarningMsg('Chưa tìm thấy Pod đang chạy cho Backend hoặc Frontend.');
          setPodLogs([]);
          return false;
        }
      }

      const compQuery = podComponent !== 'all' ? `&component=${podComponent}` : '';
      const res = await fetch(`/api/pod-logs/${encodeURIComponent(nameToUse)}?lines=${linesCount}${compQuery}`);
      if (!res.ok) {
        setPodStatus('error');
        return false;
      }
      const data = await res.json();

      if (data.status === 'success') {
        setPodStatus('running');
        setPodName(data.pod_name || null);
        const rawLines: string[] = data.logs ? data.logs.split('\n') : [];
        setPodLogs(rawLines);
        setPodWarningMsg(null);
        return true;
      } else if (data.status === 'warning') {
        setPodStatus('not_found');
        setPodName(null);
        setPodWarningMsg(data.logs || 'Chưa tìm thấy Pod đang chạy cho ứng dụng này.');
        setPodLogs([]);
        return false;
      } else {
        setPodStatus('error');
        return false;
      }
    } catch (e) {
      setPodStatus('error');
      console.error('Error fetching pod logs:', e);
      return false;
    }
  };

  // Interval polling for runtime pod logs
  useEffect(() => {
    if (activeTab !== 'runtime-logs') return;

    let isSubscribed = true;

    // Run first fetch & auto-detect if not found
    fetchPodLogs().then((success) => {
      if (!success && isSubscribed) {
        scanAvailablePods(targetAppName).then((candidate) => {
          if (candidate && isSubscribed && candidate !== targetAppName) {
            setDetectedPodSuggestion(candidate);
          }
        });
      }
    });

    const interval = setInterval(() => {
      if (isSubscribed) fetchPodLogs();
    }, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeTab, targetAppName, linesCount, isPodPaused, podComponent, project?.arch_type]);

  // Action: Manual refresh and re-scan pods
  const handleManualRefreshPod = async () => {
    setIsRefreshingPod(true);
    try {
      const success = await fetchPodLogs();
      if (!success) {
        const found = await scanAvailablePods(targetAppName);
        if (found) {
          setDetectedPodSuggestion(found);
          if (found !== targetAppName) {
            setTargetAppName(found);
            setCustomInput(found);
            try {
              localStorage.setItem(`vibe_pod_override_${appName}`, found);
            } catch {}
            await fetchPodLogs(found);
          }
        }
      }
    } finally {
      setIsRefreshingPod(false);
    }
  };

  // Action: Switch to detected pod
  const handleSwitchToDetectedPod = async (newPodName: string) => {
    setTargetAppName(newPodName);
    setCustomInput(newPodName);
    try {
      localStorage.setItem(`vibe_pod_override_${appName}`, newPodName);
    } catch {}
    setDetectedPodSuggestion(null);
    setIsRefreshingPod(true);
    try {
      await fetchPodLogs(newPodName);
    } finally {
      setIsRefreshingPod(false);
    }
  };

  // Action: Apply custom pod target
  const handleApplyCustomPodTarget = async () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setTargetAppName(trimmed);
    try {
      localStorage.setItem(`vibe_pod_override_${appName}`, trimmed);
    } catch {}
    setIsCustomizingPod(false);
    setIsRefreshingPod(true);
    try {
      await fetchPodLogs(trimmed);
    } finally {
      setIsRefreshingPod(false);
    }
  };

  // Action: Reset pod target to default appName
  const handleResetPodTarget = async () => {
    try {
      localStorage.removeItem(`vibe_pod_override_${appName}`);
    } catch {}
    setTargetAppName(appName);
    setCustomInput(appName);
    setIsCustomizingPod(false);
    setIsRefreshingPod(true);
    try {
      await fetchPodLogs(appName);
    } finally {
      setIsRefreshingPod(false);
    }
  };

  // Auto-scroll pod logs
  useEffect(() => {
    if (activeTab === 'runtime-logs' && podAutoScroll && !isPodPaused) {
      podLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [podLogs, activeTab, podAutoScroll, isPodPaused]);

  // Filtered build logs
  const filteredBuildLogs = useMemo(() => {
    if (!buildSearch.trim()) return buildLogs;
    const q = buildSearch.toLowerCase();
    return buildLogs.filter((l) => l.toLowerCase().includes(q));
  }, [buildLogs, buildSearch]);

  // Filtered pod logs
  const filteredPodLogs = useMemo(() => {
    if (!podSearch.trim()) return podLogs;
    const q = podSearch.toLowerCase();
    return podLogs.filter((l) => l.toLowerCase().includes(q));
  }, [podLogs, podSearch]);

  const handleCopyPodName = () => {
    if (!podName) return;
    navigator.clipboard.writeText(podName);
    setCopiedPodName(true);
    setTimeout(() => setCopiedPodName(false), 2000);
  };

  const handleCopyAllPodLogs = () => {
    if (podLogs.length === 0) return;
    navigator.clipboard.writeText(podLogs.join('\n'));
    setCopiedAllLogs(true);
    setTimeout(() => setCopiedAllLogs(false), 2000);
  };

  // Syntax colorizer for runtime logs
  const getPodLineColor = (line: string) => {
    const upper = line.toUpperCase();
    if (
      upper.includes('ERROR') ||
      upper.includes('FATAL') ||
      upper.includes('EXCEPTION') ||
      upper.includes('FAIL')
    ) {
      return 'text-red-400 bg-red-500/10';
    }
    if (upper.includes('WARN') || upper.includes('WARNING')) {
      return 'text-amber-400 bg-amber-500/5';
    }
    if (upper.includes('INFO')) {
      return 'text-zinc-200';
    }
    if (upper.includes('DEBUG') || upper.includes('TRACE')) {
      return 'text-zinc-500';
    }
    if (upper.includes('STARTED') || upper.includes('SUCCESS')) {
      return 'text-emerald-400 font-medium';
    }
    return 'text-zinc-300';
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Dashboard
      </Link>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary font-bold text-lg">
            {appName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{appName}</h1>
              {project?.status === 'active' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Active
                </span>
              )}
              {project?.status === 'deploying' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-full border border-yellow-500/20">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Deploying
                </span>
              )}
              {project?.status === 'failed' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                  <AlertCircle className="w-3 h-3" />
                  Failed
                </span>
              )}
              {project?.arch_type === 'fullstack' && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                  <Layers className="w-3 h-3" />
                  Fullstack
                </span>
              )}
              {project?.arch_type === 'monorepo' && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                  <Code2 className="w-3 h-3 text-indigo-400" />
                  Monorepo
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              {project?.arch_type === 'fullstack' || project?.arch_type === 'monorepo' ? (
                <>
                  {(project.fe_domain || project.app_domain) && (
                    <a
                      href={`https://${project.fe_domain || project.app_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-muted-foreground">FE:</span> {project.fe_domain || project.app_domain}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                  {project.be_domain && (
                    <a
                      href={`https://${project.be_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-muted-foreground">BE:</span> {project.be_domain}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                  {project.arch_type === 'monorepo' ? (
                    <a
                      href={project.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate max-w-xs">{project.repo_url.replace('https://github.com/', '')}</span>
                    </a>
                  ) : (
                    <>
                      {project.fe_repo_url && (
                        <a
                          href={project.fe_repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate max-w-xs">FE: {project.fe_repo_url.replace('https://github.com/', '')}</span>
                        </a>
                      )}
                      {project.be_repo_url && (
                        <a
                          href={project.be_repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate max-w-xs">BE: {project.be_repo_url.replace('https://github.com/', '')}</span>
                        </a>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  {project && (
                    <a
                      href={`https://${project.app_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      {project.app_domain}
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                  {project && (
                    <a
                      href={project.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="truncate max-w-xs">{project.repo_url.replace('https://github.com/', '')}</span>
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Visit App Buttons */}
        {project && (
          <div className="flex items-center gap-2 shrink-0">
            {project.arch_type === 'fullstack' || project.arch_type === 'monorepo' ? (
              <>
                {(project.fe_domain || (project.arch_type !== 'monorepo' && project.app_domain)) && (
                  <a
                    href={`https://${project.fe_domain || project.app_domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-xs active:scale-95"
                  >
                    Visit Frontend
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {project.be_domain && (
                  <a
                    href={`https://${project.be_domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground border border-border px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-xs active:scale-95"
                  >
                    API Backend
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </>
            ) : (
              <a
                href={`https://${project.app_domain}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-xs active:scale-95"
              >
                Visit Site
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Tabs Navigation (Railway / Vercel style) */}
      <div className="flex items-center gap-2 border-b border-border mt-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('code-editor')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'code-editor'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code2 className="w-4 h-4 text-indigo-400" />
          <span>Mã nguồn</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
            Editor
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ai-debug')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ai-debug'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>AI Debug</span>
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            Hermes
          </span>
        </button>

        <button
          onClick={() => setActiveTab('deploy-history')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'deploy-history'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4 text-violet-400" />
          <span>Lịch sử Triển khai</span>
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
            Rollback
          </span>
        </button>

        <button
          onClick={() => setActiveTab('runtime-logs')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'runtime-logs'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Runtime Logs</span>
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Live
          </span>
        </button>

        <button
          onClick={() => setActiveTab('build-logs')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'build-logs'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Build Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Settings & CI/CD
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {/* TAB 0: CODE EDITOR (FILE MANAGER & GITHUB PUSH) */}
        {activeTab === 'code-editor' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-indigo-400" />
                  Mã nguồn & Quản lý tập tin (File Manager)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Duyệt cấu trúc dự án, chỉnh sửa code hoặc file cấu hình trực tiếp với Monaco Editor, và đẩy thay đổi lên GitHub.
                </p>
              </div>
            </div>

            <CodeEditorTab appName={appName} project={project} />
          </motion.div>
        )}

        {/* TAB 0.5: AI DEBUG & AUTO-HEAL (HERMES AGENT) */}
        {activeTab === 'ai-debug' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <AiDebugTab
              appName={appName}
              onOpenLogs={() => setActiveTab('runtime-logs')}
            />
          </motion.div>
        )}

        {/* TAB 0.7: DEPLOY HISTORY & ROLLBACK */}
        {activeTab === 'deploy-history' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <DeployHistoryTab appName={appName} project={project} />
          </motion.div>
        )}

        {/* TAB 1: RUNTIME LOGS (POD LOGS) */}
        {activeTab === 'runtime-logs' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Box className="w-5 h-5 text-emerald-400" />
                  Container Runtime Logs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Theo dõi log trực tiếp từ Pod Kubernetes đang chạy của {appName}.
                  {targetAppName !== appName && (
                    <span className="ml-1 text-indigo-400 font-mono text-[11px]">
                      (Đang trỏ tới: {targetAppName})
                    </span>
                  )}
                </p>
              </div>

              {/* Right: Pod Badge + Refresh & Custom Name Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {podName && (
                  <div className="flex items-center gap-2 bg-muted/40 border border-border px-3 py-1.5 rounded-lg text-xs font-mono">
                    <span className="text-muted-foreground">Pod:</span>
                    <span className="text-foreground font-semibold truncate max-w-[220px]" title={podName}>{podName}</span>
                    <button
                      onClick={handleCopyPodName}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                      title="Copy Pod Name"
                    >
                      {copiedPodName ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}

                {/* Nút Cập nhật / Quét lại Pod */}
                <button
                  onClick={handleManualRefreshPod}
                  disabled={isRefreshingPod}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 hover:bg-muted text-foreground border border-border rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                  title="Lấy lại và đồng bộ chính xác tên Pod mới nhất từ Kubernetes"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPod ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                  <span>{isRefreshingPod ? 'Đang quét Pod...' : 'Cập nhật Pod'}</span>
                </button>

                {/* Nút Sửa tên Pod / Đổi định danh K8s */}
                <button
                  onClick={() => setIsCustomizingPod(!isCustomizingPod)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${
                    isCustomizingPod
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                  }`}
                  title="Chỉnh sửa định danh Pod nếu bạn tạo pod thủ công trên K8s"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{targetAppName !== appName ? targetAppName : 'Sửa tên Pod'}</span>
                </button>
              </div>
            </div>

            {/* Panel tùy chỉnh định danh Pod K8s */}
            <AnimatePresence>
              {isCustomizingPod && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-card/70 border border-indigo-500/30 rounded-xl p-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden shadow-lg"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      Tùy chỉnh định danh Pod Kubernetes
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Nếu bạn tạo Pod mới hoặc sửa thủ công trên K8s (ví dụ: {appName}-fe), hãy nhập tên bên dưới để lấy đúng log.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="vd: tttn-3tshop-fe"
                      className="bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground font-mono focus:border-indigo-500 outline-none w-full sm:w-56"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyCustomPodTarget();
                      }}
                    />
                    <button
                      onClick={handleApplyCustomPodTarget}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      Áp dụng
                    </button>
                    {targetAppName !== appName && (
                      <button
                        onClick={handleResetPodTarget}
                        className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-xs rounded-md transition-colors whitespace-nowrap"
                        title="Đặt lại theo tên dự án mặc định"
                      >
                        Mặc định
                      </button>
                    )}
                    <button
                      onClick={() => setIsCustomizingPod(false)}
                      className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors"
                    >
                      Đóng
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Terminal Window for Runtime Logs */}
            <div className="bg-[#0A0A0A] border border-border rounded-xl overflow-hidden shadow-2xl flex flex-col">
              {/* Terminal Toolbar */}
              <div className="bg-[#121212] border-b border-border/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Left: Stream status & Live pulse */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        podStatus === 'running'
                          ? isPodPaused
                            ? 'bg-amber-400'
                            : 'bg-emerald-400 animate-pulse'
                          : podStatus === 'not_found'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {podStatus === 'running'
                        ? isPodPaused
                          ? 'Tạm dừng (Paused)'
                          : 'Live Streaming'
                        : podStatus === 'not_found'
                        ? 'Pod chưa khởi chạy'
                        : 'Lỗi tải log'}
                    </span>
                  </div>

                  {/* Component Filter Buttons (Toàn bộ / Backend Pod / Frontend Pod) */}
                  <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-border/80 text-[11px]">
                    <button
                      onClick={() => setPodComponent('all')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        podComponent === 'all'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Toàn bộ
                    </button>
                    <button
                      onClick={() => {
                        setPodComponent('be');
                        if (linesCount < 200) setLinesCount(200);
                      }}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        podComponent === 'be'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Chỉ xem Pod Backend (GET /api/pod-logs/{app_name}?component=be&lines=200)"
                    >
                      Backend Pod
                    </button>
                    <button
                      onClick={() => {
                        setPodComponent('fe');
                        if (linesCount < 200) setLinesCount(200);
                      }}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        podComponent === 'fe'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Chỉ xem Pod Frontend (GET /api/pod-logs/{app_name}?component=fe&lines=200)"
                    >
                      Frontend Pod
                    </button>
                  </div>

                  {/* Search / Filter in Logs */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Lọc từ khóa (ERROR, INFO...)"
                      value={podSearch}
                      onChange={(e) => setPodSearch(e.target.value)}
                      className="bg-black/50 border border-border/80 rounded-md pl-8 pr-3 py-1 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/60 w-40 sm:w-52 transition-all"
                    />
                  </div>
                </div>

                {/* Right: Controls (Lines, Pause, Auto-scroll, Copy) */}
                <div className="flex items-center gap-2">
                  {/* Lines Count Selector */}
                  <select
                    value={linesCount}
                    onChange={(e) => setLinesCount(Number(e.target.value))}
                    className="bg-black/50 border border-border/80 text-muted-foreground hover:text-foreground text-[11px] rounded-md px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="50">50 dòng</option>
                    <option value="100">100 dòng</option>
                    <option value="200">200 dòng</option>
                    <option value="500">500 dòng</option>
                  </select>

                  {/* Pause / Resume button */}
                  <button
                    onClick={() => setIsPodPaused(!isPodPaused)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors border ${
                      isPodPaused
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                        : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                    }`}
                    title={isPodPaused ? 'Resume stream' : 'Pause stream'}
                  >
                    {isPodPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    <span>{isPodPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                  </button>

                  {/* Auto-scroll toggle */}
                  <button
                    onClick={() => setPodAutoScroll(!podAutoScroll)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors border ${
                      podAutoScroll
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-muted/40 text-muted-foreground border-border'
                    }`}
                    title="Toggle auto-scroll to bottom"
                  >
                    <ArrowDown className="w-3 h-3" />
                    <span>Auto-scroll</span>
                  </button>

                  {/* Copy All Logs */}
                  <button
                    onClick={handleCopyAllPodLogs}
                    disabled={isMounted ? podLogs.length === 0 : false}
                    suppressHydrationWarning
                    className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Copy all logs"
                  >
                    {copiedAllLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Log Output Console */}
              <div className="p-4 font-mono text-xs text-zinc-300 h-[500px] overflow-y-auto space-y-1 selection:bg-white/20">
                {podStatus === 'loading' && podLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Đang kết nối tới container pod...</span>
                  </div>
                ) : podStatus === 'not_found' ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-400 opacity-80" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {podWarningMsg || 'Chưa tìm thấy Pod đang chạy cho ứng dụng này.'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md">
                        Hệ thống đang truy vấn Pod theo định danh: <code className="text-amber-300 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">{targetAppName}</code>
                      </p>
                    </div>

                    {/* Suggestion banner if detected */}
                    {detectedPodSuggestion && detectedPodSuggestion !== targetAppName && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 max-w-md text-left flex items-start gap-3 my-1">
                        <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-emerald-300">
                            Phát hiện Pod đang chạy trên Kubernetes!
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Tìm thấy Pod hoạt động với tên: <strong className="text-foreground font-mono">{detectedPodSuggestion}</strong>
                          </div>
                          <button
                            onClick={() => handleSwitchToDetectedPod(detectedPodSuggestion)}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-all shadow"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Chuyển sang Pod này ngay
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                      <button
                        onClick={handleManualRefreshPod}
                        disabled={isRefreshingPod}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPod ? 'animate-spin' : ''}`} />
                        <span>{isRefreshingPod ? 'Đang quét Pods...' : 'Quét & Cập nhật lại Pods'}</span>
                      </button>

                      <button
                        onClick={() => setIsCustomizingPod(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-md text-xs font-medium transition-all border border-border"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Sửa tên Pod thủ công
                      </button>

                      <button
                        onClick={() => setActiveTab('build-logs')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-muted/40 hover:bg-muted/60 text-muted-foreground hover:text-foreground rounded-md text-xs font-medium transition-all"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        Xem Build Logs
                      </button>
                    </div>
                  </div>
                ) : filteredPodLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs">
                    {podSearch ? (
                      <span>Không tìm thấy dòng log khớp với từ khóa "{podSearch}"</span>
                    ) : (
                      <span>Không có log nào từ container</span>
                    )}
                  </div>
                ) : (
                  filteredPodLogs.map((line, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed px-1.5 py-0.5 rounded whitespace-pre-wrap break-all ${getPodLineColor(
                        line
                      )}`}
                    >
                      {line}
                    </div>
                  ))
                )}
                <div ref={podLogsEndRef} />
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: BUILD LOGS */}
        {activeTab === 'build-logs' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-sky-400" />
                  Build & Deployment Logs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tiến trình kéo mã nguồn, Nixpacks/Docker compile và apply manifests K3s.
                </p>
              </div>

              {/* Build Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Lọc tiến trình build..."
                  value={buildSearch}
                  onChange={(e) => setBuildSearch(e.target.value)}
                  className="bg-black/50 border border-border/80 rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/60 w-56 transition-all"
                />
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-border rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-[#121212] border-b border-border/70 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  <span>Build Output Console: {appName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px] text-sky-400">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
                    Console Stream
                  </span>
                  <button
                    onClick={() => setBuildAutoScroll(!buildAutoScroll)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                      buildAutoScroll
                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                        : 'bg-muted/30 text-muted-foreground border-border'
                    }`}
                  >
                    Auto-scroll
                  </button>
                </div>
              </div>

              <div className="p-4 font-mono text-xs text-zinc-300 h-[500px] overflow-y-auto space-y-1">
                {filteredBuildLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    {buildSearch ? `Không tìm thấy dòng khớp "${buildSearch}"` : 'Đang tải console logs...'}
                  </div>
                ) : (
                  filteredBuildLogs.map((line, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed px-1 rounded whitespace-pre-wrap break-all ${
                        line.includes('HOÀN TẤT') || line.includes('Successfully')
                          ? 'text-green-400 font-semibold bg-green-500/5'
                          : line.includes('ERROR') || line.includes('failed')
                          ? 'text-red-400 bg-red-500/10'
                          : line.includes('BẮT ĐẦU') || line.includes('Deploy')
                          ? 'text-blue-400 font-medium'
                          : 'text-zinc-300'
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}
                <div ref={buildLogsEndRef} />
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: SETTINGS & CI/CD */}
        {activeTab === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-foreground">CI/CD Management</h2>
              <p className="text-xs text-muted-foreground">
                Configure automated deployments and trigger manual rebuilds for {appName}.
              </p>
            </div>

            <ProjectCicdSettings
              appName={appName}
              onOpenTerminal={() => setActiveTab('build-logs')}
            />
          </motion.div>
        )}

        {/* TAB 4: OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col gap-4">
              <h3 className="font-semibold text-base text-foreground">Deployment Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Architecture:</span>
                  <span className="font-mono text-xs text-foreground uppercase">
                    {project?.arch_type === 'fullstack'
                      ? 'Fullstack 2-Repo'
                      : project?.arch_type === 'monorepo'
                      ? 'Monorepo / Open Source (Single Repo)'
                      : project?.db_type && project.db_type !== 'none'
                      ? `Web + Database (${project.db_type})`
                      : 'Web Only'}
                  </span>
                </div>

                {project?.arch_type === 'fullstack' || project?.arch_type === 'monorepo' ? (
                  <>
                    {(project.fe_domain || (project.arch_type !== 'monorepo' && project.app_domain)) && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Frontend Web Domain:</span>
                        <a
                          href={`https://${project.fe_domain || project.app_domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                        >
                          https://{project.fe_domain || project.app_domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {project.be_domain && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Backend API Domain:</span>
                        <a
                          href={`https://${project.be_domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                        >
                          https://{project.be_domain}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {project.arch_type === 'monorepo' ? (
                      <div>
                        <span className="text-xs text-muted-foreground block">Monorepo GitHub Repository:</span>
                        <a
                          href={project.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                        >
                          {project.repo_url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <>
                        {project.fe_repo_url && (
                          <div>
                            <span className="text-xs text-muted-foreground block">Frontend Repository:</span>
                            <a
                              href={project.fe_repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                            >
                              {project.fe_repo_url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {project.be_repo_url && (
                          <div>
                            <span className="text-xs text-muted-foreground block">Backend Repository:</span>
                            <a
                              href={project.be_repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                            >
                              {project.be_repo_url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-xs text-muted-foreground block">Domain:</span>
                      <a
                        href={`https://${project?.app_domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                      >
                        https://{project?.app_domain}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">GitHub Repository:</span>
                      <a
                        href={project?.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground hover:underline font-mono text-xs flex items-center gap-1 mt-0.5"
                      >
                        {project?.repo_url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </>
                )}

                {project?.db_type && project.db_type !== 'none' && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Database:</span>
                    <span className="font-mono text-xs text-foreground uppercase">{project.db_type}</span>
                  </div>
                )}

                <div>
                  <span className="text-xs text-muted-foreground block">Branch:</span>
                  <span className="font-mono text-xs text-foreground">main</span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Created At:</span>
                  <span className="text-xs text-foreground">
                    {project?.createdAt
                      ? new Date(project.createdAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-base text-foreground">Quick Actions</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Easily switch to logs or adjust automated deployment triggers.
                </p>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => setActiveTab('ai-debug')}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors group"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>Hermes AI Chẩn đoán & Tự phục hồi</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('code-editor')}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  >
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    Trình biên tập mã nguồn (Monaco Editor)
                  </button>
                  <button
                    onClick={() => setActiveTab('runtime-logs')}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  >
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    View Live Container Runtime Logs
                  </button>
                  <button
                    onClick={() => setActiveTab('build-logs')}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  >
                    <Terminal className="w-4 h-4 text-sky-400" />
                    View Build & Deploy Console
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors"
                  >
                    <Sliders className="w-4 h-4 text-primary" />
                    Configure CI/CD Webhook
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4">
                <span className="text-xs text-muted-foreground">
                  Powered by K3s & Traefik Ingress
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
