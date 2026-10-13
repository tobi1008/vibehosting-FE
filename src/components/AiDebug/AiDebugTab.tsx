'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Terminal,
  FileCode,
  Sliders,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Check,
  Cpu,
  Layers,
  Wrench,
  HelpCircle,
  Copy,
  Send,
  User,
  Bot,
  RefreshCcw,
  MessageSquare,
  ArrowRight,
  Trash2,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AiProviderSelector } from '@/components/AiEngine/AiProviderSelector';
import { useAiProvider } from '@/lib/useAiProvider';

export interface DebugAction {
  action_type: 'set_env' | 'exec_pod' | 'edit_file' | 'restart_deployment' | 'restart' | string;
  target?: string;
  description: string;
  env_vars?: Record<string, string>;
  command?: string;
  file_path?: string;
  diff?: string;
  [key: string]: any;
}

export interface DebugAnalysisResponse {
  status: 'success' | 'error';
  app_name: string;
  diagnosis: string;
  root_cause: string;
  suggested_solution: string;
  actions: DebugAction[];
  applied?: boolean;
  execution_results?: any[];
  [key: string]: any;
}

export interface ProcessLog {
  id: string;
  time: string;
  text: string;
  type: 'agent' | 'hermes' | 'k8s' | 'info' | 'warn' | 'success' | 'error';
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface AiDebugTabProps {
  appName: string;
  onOpenLogs?: () => void;
}

const ANALYSIS_STAGES = [
  { id: 1, label: 'Kết nối K3s & Pod' },
  { id: 2, label: 'Đọc Runtime Logs' },
  { id: 3, label: 'Quét Environment' },
  { id: 4, label: 'AI DevOps Agent Reasoning' },
  { id: 5, label: 'Sinh Action Items' },
];

const CHAT_QUICK_CHIPS = [
  'Tôi thấy log báo lỗi CORS, bạn giải thích kỹ hơn được không?',
  'Tại sao Pod lại bị CrashLoopBackOff hoặc container not found?',
  'Giải thích các hành động sửa file mà bạn vừa đề xuất',
  'Đọc lại log Pod mới nhất xem tình trạng hiện tại thế nào',
];

export function AiDebugTab({ appName, onOpenLogs }: AiDebugTabProps) {
  // Main Sub-Tab view: 'dashboard' (Tab 1) | 'chat' (Tab 2)
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'chat'>('dashboard');

  // Common Configuration
  const [component, setComponent] = useState<'be' | 'fe' | 'all'>('be');
  const { selectedProvider: selectedAiProvider, setProvider: setSelectedAiProvider, currentProvider } = useAiProvider();

  // Tab 1 (Dashboard) State
  const [userNote, setUserNote] = useState('');
  const [autoApply, setAutoApply] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DebugAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedActionIndexes, setSelectedActionIndexes] = useState<Set<number>>(new Set());
  const [expandedActionIndexes, setExpandedActionIndexes] = useState<Set<number>>(new Set());
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<any[] | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Tab 1 Live Terminal State
  const [showTerminal, setShowTerminal] = useState(true);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [processLogs, setProcessLogs] = useState<ProcessLog[]>([
    {
      id: 'init-1',
      time: 'READY',
      text: `[AI-DEVOPS-AGENT] AI DevOps Agent Autonomous Diagnostic Terminal v2.6 sẵn sàng cho '${appName}'.`,
      type: 'agent',
    },
    {
      id: 'init-2',
      time: 'K3S',
      text: `[CLUSTER] Cụm Kubernetes K3s: Đã kết nối. Bấm [⚡ AI DevOps Agent Phân tích sự cố] để quét lỗi hoặc mở [Khung Chat] để thảo luận.`,
      type: 'k8s',
    },
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const logTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Tab 2 (Khung Chat) State
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
    {
      role: 'assistant',
      content: `Xin chào! Mình là AI DevOps Agent, trợ lý DevOps & AI SRE phụ trách ứng dụng **${appName}**.\n\nMỗi khi bạn nhắn tin, mình sẽ **tự động đọc lại log Pod mới nhất trên cụm Kubernetes** để giải thích cặn kẽ nguyên nhân và thảo luận cùng bạn trước khi áp dụng các thay đổi.\n\nBạn đang gặp vấn đề gì hoặc muốn mình kiểm tra phần nào?`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll Terminal
  useEffect(() => {
    if (showTerminal && (isAnalyzing || isExecuting)) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [processLogs, showTerminal, isAnalyzing, isExecuting]);

  // Auto scroll Chat
  useEffect(() => {
    if (activeSubTab === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeSubTab, isChatLoading]);

  // Helper to add timestamped log
  const addLog = (text: string, type: ProcessLog['type'] = 'info') => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const newLog: ProcessLog = {
      id: Math.random().toString(36).substring(2, 9),
      time,
      text,
      type,
    };
    setProcessLogs((prev) => [...prev, newLog]);
  };

  const clearLogTimers = () => {
    logTimersRef.current.forEach((t) => clearTimeout(t));
    logTimersRef.current = [];
  };

  // Trigger AI DevOps Agent Analysis (/api/ai-debug/analyze)
  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    clearLogTimers();
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    setExecutionResults(null);
    setExecutionError(null);
    setProcessLogs([]);
    setCurrentStage(1);

    const engineName =
      currentProvider?.name ||
      (selectedAiProvider === 'claude'
        ? 'Claude Code (Anthropic)'
        : selectedAiProvider === 'hermes'
        ? 'Hermes Agent'
        : 'Google Antigravity');
    addLog(`[AI-DEVOPS-AGENT] Bắt đầu phiên chẩn đoán tự động (${engineName}) cho ứng dụng '${appName}' (target: ${component.toUpperCase()})...`, 'agent');

    const timer1 = setTimeout(() => {
      setCurrentStage(1);
      addLog(`[K8S-CLUSTER] Kết nối tới Kubernetes API server... Cụm K3s node phản hồi OK.`, 'k8s');
    }, 700);

    const timer2 = setTimeout(() => {
      setCurrentStage(2);
      addLog(`[POD-DISCOVERY] Quét Pod đang chạy cho '${appName}' component '${component}'...`, 'info');
      addLog(`[LOG-COLLECTOR] Thu thập 200 dòng logs mới nhất từ Pod runtime (stdout/stderr)...`, 'info');
    }, 2500);

    const timer3 = setTimeout(() => {
      setCurrentStage(3);
      addLog(`[CONFIG-INSPECTOR] Đọc biến môi trường (ConfigMaps, Secrets, Ingress routing rules)...`, 'k8s');
      if (userNote.trim()) {
        addLog(`[USER-OBSERVATION] Ghi nhận phản ánh từ người dùng: "${userNote.trim()}"`, 'warn');
      }
    }, 5500);

    const timer4 = setTimeout(() => {
      setCurrentStage(4);
      addLog(`[AI-DEVOPS-AGENT-REASONER] Bắt đầu mô hình suy luận ${engineName}: đối chiếu mã nguồn, cấu hình CORS, Prisma migrations, Port mapping...`, 'agent');
      addLog(`[AST-ANALYZER] Quét stack traces và các ngoại lệ kết nối...`, 'info');
    }, 10000);

    logTimersRef.current = [timer1, timer2, timer3, timer4];

    try {
      const res = await fetch('/api/ai-debug/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName,
          component,
          user_note: userNote.trim() || undefined,
          auto_apply: autoApply,
          ai_provider: selectedAiProvider,
        }),
      });

      const data = await res.json();
      clearLogTimers();

      if (!res.ok) {
        throw new Error(data.error || 'AI DevOps Agent không thể phân tích ứng dụng');
      }

      setCurrentStage(5);
      addLog(`[AI-DEVOPS-AGENT] Hoàn tất chẩn đoán! Nguyên nhân cốt lõi xác định: ${data.root_cause || 'DETECTED'}`, 'success');
      addLog(`[AI-DEVOPS-AGENT] Đã tạo ${data.actions?.length || 0} hành động khắc phục sẵn sàng thực thi.`, 'success');

      setAnalysis(data);

      // Select all suggested actions by default
      if (Array.isArray(data.actions)) {
        const initialSelected = new Set<number>();
        data.actions.forEach((_: any, idx: number) => initialSelected.add(idx));
        setSelectedActionIndexes(initialSelected);
      }

      // If auto_apply was enabled and returned results
      if (data.applied && Array.isArray(data.execution_results)) {
        addLog(`[AUTO-HEAL] Chế độ tự phục hồi được bật: Đang áp dụng các hành động trực tiếp lên K8s...`, 'warn');
        setExecutionResults(data.execution_results);
      }

      // Add a friendly contextual hint into Chat
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `📌 **Cập nhật từ Dashboard:** Mình vừa hoàn tất quét Pod và phát hiện nguyên nhân cốt lõi là **\`${data.root_cause || 'DETECTED_ISSUE'}\`**.\n\nĐã đề xuất **${data.actions?.length || 0} hành động khắc phục** trong tab Dashboard. Bạn có thể hỏi mình chi tiết về nguyên nhân này hoặc bấm sang Dashboard để áp dụng nhé!`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      clearLogTimers();
      console.error('Error in AI Debug analysis:', err);
      addLog(`[ERROR] Phân tích thất bại: ${err?.message}`, 'error');
      setAnalysisError(err?.message || 'Không thể thực hiện chẩn đoán');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Toggle selection for an action
  const toggleActionSelection = (index: number) => {
    setSelectedActionIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Toggle detail accordion for an action
  const toggleActionAccordion = (index: number) => {
    setExpandedActionIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (!analysis?.actions) return;
    if (select) {
      const all = new Set<number>();
      analysis.actions.forEach((_, idx) => all.add(idx));
      setSelectedActionIndexes(all);
    } else {
      setSelectedActionIndexes(new Set());
    }
  };

  // Execute selected actions
  const handleExecuteSelected = async () => {
    if (!analysis?.actions || selectedActionIndexes.size === 0 || isExecuting) return;

    const actionsToExecute = analysis.actions.filter((_, idx) =>
      selectedActionIndexes.has(idx)
    );

    setIsExecuting(true);
    setExecutionError(null);

    addLog(`[AI-DEVOPS-AGENT] Bắt đầu thực thi ${actionsToExecute.length} hành động đã chọn lên cụm K8s...`, 'agent');
    actionsToExecute.forEach((act, i) => {
      addLog(`  -> [Action #${i + 1}] (${act.action_type}) ${act.description}`, 'info');
    });

    try {
      const res = await fetch(`/api/ai-debug/${appName}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: actionsToExecute }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          (res.status === 500
            ? 'Máy chủ Backend gặp sự cố nội bộ (500) khi thực thi K8s. Vui lòng kiểm tra lại Pod.'
            : `Lỗi máy chủ (${res.status}): ${rawText.slice(0, 150)}`)
        );
      }

      const results = data.results || [];
      setExecutionResults(results);

      addLog(`[AI-DEVOPS-AGENT] Hoàn tất thực thi ${results.length} hành động trên cụm K8s!`, 'success');
      results.forEach((r: any, idx: number) => {
        const itemResult = r.result || {};
        const isSuccess = itemResult.status === 'success' || r.status === 'success' || itemResult.success === true;
        const msg = itemResult.message || r.message || (isSuccess ? 'Thành công' : 'Thất bại');
        addLog(`  ${isSuccess ? '✓' : '✗'} Hành động #${idx + 1}: ${msg}`, isSuccess ? 'success' : 'error');
      });
    } catch (err: any) {
      console.error('Execute error:', err);
      addLog(`[ERROR] Lỗi khi thực thi: ${err?.message}`, 'error');
      setExecutionError(err?.message || 'Có lỗi xảy ra khi thực thi hành động');
    } finally {
      setIsExecuting(false);
    }
  };

  // Send Chat Message to /api/ai-debug/chat
  const handleSendChatMessage = async (customMessage?: string) => {
    const msgToSend = (customMessage || chatInput).trim();
    if (!msgToSend || isChatLoading) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg: ChatHistoryItem = { role: 'user', content: msgToSend, timestamp: timeStr };
    const updatedHistory = [...chatHistory, userMsg];

    setChatHistory(updatedHistory);
    setChatInput('');
    setIsChatLoading(true);

    // Send history with only { role, content } according to API contract
    const apiHistory = chatHistory.map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch('/api/ai-debug/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName,
          component: component === 'all' ? 'be' : component,
          message: msgToSend,
          history: apiHistory,
          ai_provider: selectedAiProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI DevOps Agent Chat phản hồi không thành công');
      }

      const assistantMsg: ChatHistoryItem = {
        role: 'assistant',
        content: data.reply || data.message || 'Không nhận được nội dung trả lời từ AI DevOps Agent.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setChatHistory([...updatedHistory, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatHistoryItem = {
        role: 'assistant',
        content: `❌ Lỗi khi kết nối với AI DevOps Agent: ${err?.message || 'Vui lòng kiểm tra lại kết nối mạng.'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory([...updatedHistory, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Clear Chat History
  const handleClearChat = () => {
    setChatHistory([
      {
        role: 'assistant',
        content: `Đã làm mới cuộc hội thoại. Bạn muốn thảo luận hoặc kiểm tra vấn đề gì tiếp theo trên Pod **${appName}**?`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Switch to Chat tab and prefill a question about current diagnosis
  const handleDiscussInChat = () => {
    setActiveSubTab('chat');
    if (analysis?.root_cause) {
      handleSendChatMessage(`Tôi thấy chẩn đoán báo nguyên nhân là "${analysis.root_cause}", bạn có thể giải thích chi tiết hơn tại sao lại xảy ra lỗi này không?`);
    }
  };

  // Copy terminal logs
  const handleCopyLogs = () => {
    const raw = processLogs.map((l) => `[${l.time}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(raw);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Badge resolver for action types
  const getActionBadge = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('edit') || t.includes('file')) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <FileCode className="w-3 h-3" />
          Sửa mã nguồn (edit_file)
        </span>
      );
    }
    if (t.includes('exec') || t.includes('cmd') || t.includes('pod')) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <Terminal className="w-3 h-3" />
          Chạy lệnh Shell trong Pod (exec_pod)
        </span>
      );
    }
    if (t.includes('env')) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
          <Sliders className="w-3 h-3" />
          Bơm biến môi trường K8s (set_env)
        </span>
      );
    }
    if (t.includes('restart')) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-700/30 text-zinc-300 border border-zinc-600/40">
          <RotateCcw className="w-3 h-3" />
          Khởi động lại Pod (restart_deployment)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
        <Wrench className="w-3 h-3" />
        {type}
      </span>
    );
  };

  const getLogTextColor = (type: ProcessLog['type']) => {
    switch (type) {
      case 'agent':
      case 'hermes':
        return 'text-indigo-400 font-medium';
      case 'k8s':
        return 'text-sky-400';
      case 'warn':
        return 'text-amber-300';
      case 'success':
        return 'text-emerald-400 font-semibold';
      case 'error':
        return 'text-rose-400 font-semibold';
      default:
        return 'text-zinc-300';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. SUB-TAB HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-xs">
        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setActiveSubTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'dashboard'
                ? 'bg-background text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            <span>Dashboard Chẩn đoán & Sửa lỗi</span>
            {analysis?.actions && analysis.actions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {analysis.actions.length} action
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
              activeSubTab === 'chat'
                ? 'bg-background text-foreground shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Khung Chat với AI DevOps Agent</span>
            <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live K8s
            </span>
          </button>
        </div>

        {/* Right Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Engine Switcher */}
          <AiProviderSelector
            variant="toggle"
            value={selectedAiProvider}
            onChange={setSelectedAiProvider}
          />

          {activeSubTab === 'dashboard' && (
            <button
              type="button"
              onClick={() => setShowTerminal(!showTerminal)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showTerminal
                  ? 'bg-zinc-800 text-foreground border-border'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border-border/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{showTerminal ? 'Ẩn Terminal' : 'Mở Terminal K8s'}</span>
            </button>
          )}

          {activeSubTab === 'chat' && (
            <button
              type="button"
              onClick={handleClearChat}
              className="px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Xóa lịch sử cuộc trò chuyện"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Làm mới chat</span>
            </button>
          )}

          {onOpenLogs && (
            <button
              type="button"
              onClick={onOpenLogs}
              className="px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Runtime Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DASHBOARD CHẨN ĐOÁN & DANH SÁCH ACTION (Gọi /api/ai-debug/analyze) */}
      {/* ========================================================================= */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Activation Form Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    AI DevOps Agent Autonomous Diagnostic Dashboard
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-mono">
                      Root Cause & Actions
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Tự động kết nối cụm K3s, thu thập runtime logs và phân tích nguyên nhân cốt lõi kèm danh sách hành động sửa lỗi.
                  </p>
                </div>
              </div>
              <AiProviderSelector
                variant="dropdown"
                value={selectedAiProvider}
                onChange={setSelectedAiProvider}
              />
            </div>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Component Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                    Thành phần kiểm tra (Component)
                  </label>
                  <select
                    value={component}
                    onChange={(e) => setComponent(e.target.value as any)}
                    disabled={isAnalyzing}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="be">Backend (BE)</option>
                    <option value="fe">Frontend (FE)</option>
                    <option value="all">Cả hai (All - BE + FE)</option>
                  </select>
                </div>

                {/* User Note Input */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      Ghi chú bổ sung (User Note - Tùy chọn)
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 font-normal">
                      Mô tả triệu chứng cụ thể
                    </span>
                  </label>
                  <input
                    type="text"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Ví dụ: Đăng nhập báo sai SĐT dù đã seed, hoặc gọi API bị lỗi CORS..."
                    disabled={isAnalyzing}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Actions & Auto-heal Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    disabled={isAnalyzing}
                    className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium">Tự động áp dụng giải pháp nếu độ tin cậy cao (Auto-heal)</span>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI DevOps Agent đang phân tích cụm K3s...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>⚡ AI DevOps Agent Phân tích sự cố</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Terminal Console */}
          {showTerminal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-black/90 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl font-mono text-xs select-text"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-zinc-400 text-[11px] font-semibold pl-2">
                    ai-devops-agent-console:~$ k8s-autonomous-diag --app={appName}
                  </span>
                </div>

                <button
                  onClick={handleCopyLogs}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedLogs ? 'Đã sao chép' : 'Sao chép log'}</span>
                </button>
              </div>

              {/* Terminal Stages Breadcrumb */}
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950/80 border-b border-zinc-800/80 overflow-x-auto text-[11px]">
                {ANALYSIS_STAGES.map((st) => {
                  const isCurrent = currentStage === st.id;
                  const isPast = currentStage > st.id;
                  return (
                    <div key={st.id} className="flex items-center gap-1 shrink-0">
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isPast
                            ? 'bg-emerald-500 text-black'
                            : isCurrent
                            ? 'bg-indigo-500 text-white animate-pulse'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {isPast ? '✓' : st.id}
                      </span>
                      <span
                        className={`${
                          isPast
                            ? 'text-emerald-400 font-medium'
                            : isCurrent
                            ? 'text-indigo-300 font-semibold'
                            : 'text-zinc-500'
                        }`}
                      >
                        {st.label}
                      </span>
                      {st.id < ANALYSIS_STAGES.length && (
                        <span className="text-zinc-700 ml-1">→</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Logs Content */}
              <div className="p-4 max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar bg-black/95">
                {processLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-zinc-600 select-none text-[11px] shrink-0">
                      [{log.time}]
                    </span>
                    <span className={`break-all ${getLogTextColor(log.type)}`}>
                      {log.text}
                    </span>
                  </div>
                ))}
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-indigo-400 pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="animate-pulse">AI DevOps Agent đang phân tích các luồng dữ liệu...</span>
                  </div>
                )}
                {isExecuting && (
                  <div className="flex items-center gap-2 text-emerald-400 pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="animate-pulse">Đang đẩy cấu hình và chạy lệnh trên Pod Kubernetes...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </motion.div>
          )}

          {/* Analysis Error */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Lỗi phân tích từ AI DevOps Agent:</span>
                <span className="opacity-90">{analysisError}</span>
              </div>
            </div>
          )}

          {/* Diagnosis Card & Action Items */}
          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6"
              >
                {/* THẺ ĐỎ ĐỎ CHẨN ĐOÁN (DIAGNOSIS CARD) */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/70">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Nguyên nhân cốt lõi:</span>
                      <span className="font-mono text-xs font-bold px-3 py-1 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 shadow-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        {analysis.root_cause || 'DETECTED_ISSUE'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleDiscussInChat}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all shadow-xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Hỏi cặn kẽ trong Khung Chat</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Diagnosis Detail */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground">Chi tiết chẩn đoán (Diagnosis):</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 p-3.5 rounded-lg border border-border/50 whitespace-pre-wrap">
                      {analysis.diagnosis}
                    </p>
                  </div>

                  {/* Suggested Solution */}
                  <div className="space-y-1.5 pt-1">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Hướng dẫn xử lý (Suggested Solution):
                    </h4>
                    <p className="text-xs text-emerald-300/90 leading-relaxed bg-emerald-500/5 p-3.5 rounded-lg border border-emerald-500/20 whitespace-pre-wrap">
                      {analysis.suggested_solution}
                    </p>
                  </div>
                </div>

                {/* DANH SÁCH NÚT BẤM ACTION (ACTION ITEMS) */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-indigo-400" />
                        Danh sách hành động đề xuất ({analysis.actions?.length || 0})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Chọn các hành động bạn muốn AI DevOps Agent tự động thực thi trực tiếp trên cụm K3s.
                      </p>
                    </div>

                    {analysis.actions && analysis.actions.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleSelectAll(true)}
                          className="text-indigo-400 hover:underline"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-muted-foreground">•</span>
                        <button
                          type="button"
                          onClick={() => handleSelectAll(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action items list */}
                  {!analysis.actions || analysis.actions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      Không có hành động sửa lỗi nào được yêu cầu. Hệ thống đang hoạt động ổn định!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysis.actions.map((action, idx) => {
                        const isSelected = selectedActionIndexes.has(idx);
                        const isExpanded = expandedActionIndexes.has(idx);

                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-muted/30 border-indigo-500/40 shadow-xs'
                                : 'bg-card/40 border-border/70 opacity-75'
                            }`}
                          >
                            <div className="p-3.5 flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleActionSelection(idx)}
                                className="w-4 h-4 mt-0.5 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />

                              <div className="flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  {getActionBadge(action.action_type)}
                                  {action.target && (
                                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-background border border-border text-muted-foreground">
                                      target: {action.target}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-foreground font-medium">
                                  {action.description}
                                </p>

                                <button
                                  type="button"
                                  onClick={() => toggleActionAccordion(idx)}
                                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-1"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      <span>Ẩn chi tiết</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronRight className="w-3 h-3" />
                                      <span>Xem chi tiết thông số & câu lệnh</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Accordion detail */}
                            {isExpanded && (
                              <div className="px-4 pb-3.5 pt-1 border-t border-border/40 text-xs font-mono bg-background/50 rounded-b-xl space-y-2">
                                {action.env_vars && (
                                  <div className="space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-sans">
                                      Biến môi trường:
                                    </span>
                                    <pre className="p-2 bg-black/40 rounded border border-border/60 text-emerald-300 text-[11px] overflow-x-auto">
                                      {JSON.stringify(action.env_vars, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {action.command && (
                                  <div className="space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-sans">
                                      Câu lệnh thực thi trên Pod:
                                    </span>
                                    <pre className="p-2 bg-black/40 rounded border border-border/60 text-sky-300 text-[11px] overflow-x-auto">
                                      $ {action.command}
                                    </pre>
                                  </div>
                                )}

                                {action.diff && (
                                  <div className="space-y-1">
                                    <span className="text-[11px] text-muted-foreground block font-sans">
                                      Nội dung chỉnh sửa ({action.file_path || 'file'}):
                                    </span>
                                    <pre className="p-2 bg-black/40 rounded border border-border/60 text-zinc-300 text-[11px] overflow-x-auto">
                                      {action.diff}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Nút bấm áp dụng hành động */}
                  {analysis.actions && analysis.actions.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/70">
                      <span className="text-xs text-muted-foreground">
                        Đã chọn <strong className="text-foreground">{selectedActionIndexes.size}</strong> trên tổng số {analysis.actions.length} hành động đề xuất.
                      </span>

                      <button
                        type="button"
                        onClick={handleExecuteSelected}
                        disabled={selectedActionIndexes.size === 0 || isExecuting}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        {isExecuting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI DevOps Agent đang thực thi trên cụm K3s...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>🚀 Áp dụng các hành động đã chọn ({selectedActionIndexes.size})</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Execution Error */}
                {executionError && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-semibold block">Lỗi thực thi:</span>
                      <span className="opacity-90">{executionError}</span>
                    </div>
                  </div>
                )}

                {/* Kết quả thực thi */}
                {executionResults && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-card border border-emerald-500/30 rounded-xl p-5 shadow-lg space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-border/70">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">
                            Kết quả thực thi tự phục hồi (Execution Results)
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            AI DevOps Agent đã hoàn tất thực thi các hành động trên cụm Kubernetes.
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Hoàn tất
                      </span>
                    </div>

                    <div className="space-y-2.5 font-mono text-xs">
                      {executionResults.map((res: any, idx: number) => {
                        const itemResult = res.result || {};
                        const output = String(itemResult.output || res.output || '');
                        const isSuccess = itemResult.status === 'success' || res.status === 'success' || itemResult.success === true;
                        const title = res.action || res.description || res.action_type || `Hành động #${idx + 1}`;
                        const msg = itemResult.message || res.message || (isSuccess ? 'Thành công' : 'Thất bại');

                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-lg border ${
                              isSuccess
                                ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                                : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5 font-sans font-semibold">
                              <span>{title}</span>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                                  isSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {isSuccess ? 'Thành công' : 'Thất bại'}
                              </span>
                            </div>
                            <div className="text-[11px] opacity-90">{msg}</div>
                            {output && (
                              <pre className="mt-1.5 p-2 bg-black/60 rounded border border-border/40 text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                                {output}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KHUNG CHAT VỚI AI DEVOPS AGENT (Gọi POST /api/ai-debug/chat kèm history) */}
      {/* ========================================================================= */}
      {activeSubTab === 'chat' && (
        <div className="flex flex-col h-[680px] bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in duration-200">
          {/* Chat Top Banner / Project Status */}
          <div className="px-5 py-3 bg-muted/20 border-b border-border flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">AI DevOps Agent Chat Assistant</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Target: {appName} ({component.toUpperCase()}) • Tự động đọc lại Pod logs mỗi lượt chat
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AiProviderSelector
                variant="dropdown"
                value={selectedAiProvider}
                onChange={setSelectedAiProvider}
              />

              {/* Quick link back to Dashboard if actions exist */}
              {analysis?.actions && analysis.actions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('dashboard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
                >
                  <span>Xem Action Items ({analysis.actions.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-background/50">
            {chatHistory.map((item, i) => {
              const isUser = item.role === 'user';
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-card border border-border text-foreground rounded-tl-xs space-y-2'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] pb-1 border-b border-foreground/10 opacity-75">
                      <span className="font-semibold">
                        {isUser ? 'Bạn' : 'AI DevOps Agent'}
                      </span>
                      {item.timestamp && <span>{item.timestamp}</span>}
                    </div>

                    <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                      {item.content}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Loader Indicator */}
            {isChatLoading && (
              <div className="flex items-start gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-xs p-3.5 text-xs text-muted-foreground flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span className="text-foreground font-medium animate-pulse">
                    AI DevOps Agent đang đọc log Pod mới nhất và suy luận câu trả lời...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatMessagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-5 pt-2 pb-1 bg-card/80 border-t border-border flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            <span className="text-[11px] text-muted-foreground font-medium shrink-0 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Gợi ý hỏi nhanh:
            </span>
            {CHAT_QUICK_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendChatMessage(chip)}
                disabled={isChatLoading}
                className="px-2.5 py-1 rounded-full bg-muted/60 hover:bg-indigo-500/15 hover:text-indigo-300 hover:border-indigo-500/30 border border-border/80 text-[11px] text-muted-foreground shrink-0 transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-card border-t border-border shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Hỏi AI DevOps Agent về log, nguyên nhân lỗi, cách sửa hoặc thảo luận chi tiết... (Enter để gửi)"
                disabled={isChatLoading}
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-indigo-500/80 transition-colors disabled:opacity-50 shadow-inner"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md active:scale-95 disabled:opacity-40 shrink-0"
              >
                {isChatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Gửi</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
