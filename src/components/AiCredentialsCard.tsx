'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Plus, Star, Trash2, Zap, X } from 'lucide-react';

type Credential = {
  id: string;
  provider: string;
  provider_name: string;
  label: string;
  model: string;
  base_url: string;
  key_last4: string;
  is_default: boolean;
};

type ProviderInfo = { id: string; name: string; example_model: string; needs_base_url: boolean };

type FormState = {
  id?: string;
  provider: string;
  model: string;
  api_key: string;
  base_url: string;
  label: string;
  is_default: boolean;
};

const KEY_LINKS: Record<string, string> = {
  openai: 'platform.openai.com/api-keys',
  anthropic: 'console.anthropic.com/settings/keys',
  gemini: 'aistudio.google.com/apikey',
  openai_compatible: 'OpenRouter, DeepSeek, Groq, Together, Ollama…',
};

async function fetchCredentials(): Promise<[{ credentials: Credential[]; providers: ProviderInfo[] } | null, string]> {
  try {
    const res = await fetch('/api/user/ai-credentials', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return [null, data?.error || 'Không tải được danh sách key AI'];
    return [data, ''];
  } catch {
    return [null, 'Không tải được danh sách key AI'];
  }
}

/**
 * Thẻ "Tích hợp AI": user tự gắn API key của OpenAI, Anthropic, Google Gemini hoặc API tương thích OpenAI.
 * Key được gọi thử trước khi lưu, lưu mã hóa trên Vibe Core và không bao giờ hiển thị lại (chỉ 4 ký tự cuối).
 */
export default function AiCredentialsCard() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const apply = useCallback((data: { credentials: Credential[]; providers: ProviderInfo[] } | null, err: string) => {
    if (data) {
      setCredentials(data.credentials || []);
      setProviders(data.providers || []);
    }
    setError(err);
  }, []);

  useEffect(() => {
    let active = true;
    fetchCredentials().then(([data, err]) => {
      if (!active) return;
      apply(data, err);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const reload = async () => {
    const [data, err] = await fetchCredentials();
    apply(data, err);
  };

  const providerInfo = (id: string) => providers.find((p) => p.id === id);

  const save = async () => {
    if (!form) return;
    setBusy('save');
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/user/ai-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Lưu key thất bại');
      setMessage(`Đã kiểm tra và lưu key (model trả lời: "${data?.test_reply || 'OK'}").`);
      setForm(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const action = async (cred: Credential, kind: 'test' | 'default' | 'delete') => {
    if (kind === 'delete' && !window.confirm(`Xóa key ${cred.label} (…${cred.key_last4})?`)) return;
    setBusy(`${kind}:${cred.id}`);
    setError('');
    setMessage('');
    try {
      const res =
        kind === 'delete'
          ? await fetch(`/api/user/ai-credentials?id=${cred.id}`, { method: 'DELETE' })
          : await fetch(`/api/user/ai-credentials/${cred.id}/${kind}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Thao tác thất bại');
      if (kind === 'test') setMessage(`Key ${cred.label} hoạt động (model trả lời: "${data?.reply || 'OK'}").`);
      if (kind === 'default') setMessage(`Đã đặt ${cred.label} làm key mặc định cho Hermes trên Telegram.`);
      if (kind === 'delete') setMessage(`Đã xóa key ${cred.label}.`);
      if (kind !== 'test') await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const info = form ? providerInfo(form.provider) : undefined;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          <h2 className="text-lg font-semibold text-foreground">Tích hợp AI</h2>
        </div>
        {!form && (
          <button
            onClick={() =>
              setForm({ provider: 'openai', model: '', api_key: '', base_url: '', label: '', is_default: credentials.length === 0 })
            }
            className="flex items-center gap-1.5 bg-foreground text-background px-3 py-1.5 rounded-md text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm key
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Dùng API key của chính bạn thay cho model có sẵn của hệ thống: chọn &quot;Key của bạn&quot; ở ô AI Engine khi triển khai
        hoặc AI Debug. Key mặc định được Hermes dùng khi bạn chat trên Telegram. Model gọi qua key riêng chỉ đọc dữ liệu
        Vibe Hosting gửi kèm, không chạy được lệnh trên máy chủ.
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-3 py-2 rounded-md mb-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span className="break-words">{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-md mb-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> <span className="break-words">{message}</span>
        </div>
      )}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : credentials.length === 0 && !form ? (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
          Chưa có key nào. Hệ thống đang dùng model có sẵn (Antigravity, Claude Code, Hermes).
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {credentials.map((c) => (
            <li key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm text-foreground">{c.label}</span>
                  {c.is_default && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Star className="w-3 h-3" /> Mặc định
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono break-all mt-0.5">
                  {c.provider_name} · {c.model} · …{c.key_last4}
                  {c.base_url ? ` · ${c.base_url}` : ''}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <SmallButton busy={busy === `test:${c.id}`} onClick={() => action(c, 'test')}>
                  Gọi thử
                </SmallButton>
                {!c.is_default && (
                  <SmallButton busy={busy === `default:${c.id}`} onClick={() => action(c, 'default')}>
                    Đặt mặc định
                  </SmallButton>
                )}
                <SmallButton
                  onClick={() =>
                    setForm({
                      id: c.id,
                      provider: c.provider,
                      model: c.model,
                      api_key: '',
                      base_url: c.base_url,
                      label: c.label === c.provider_name ? '' : c.label,
                      is_default: c.is_default,
                    })
                  }
                >
                  Sửa
                </SmallButton>
                <SmallButton danger busy={busy === `delete:${c.id}`} onClick={() => action(c, 'delete')}>
                  <Trash2 className="w-3.5 h-3.5" />
                </SmallButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div className="mt-4 border border-border rounded-lg p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{form.id ? 'Sửa key AI' : 'Thêm key AI'}</span>
            <button onClick={() => setForm(null)} aria-label="Đóng">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium">Hãng</span>
            <select
              value={form.provider}
              disabled={Boolean(form.id)}
              onChange={(e) => setForm({ ...form, provider: e.target.value, model: '', base_url: '' })}
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">Lấy key tại: {KEY_LINKS[form.provider]}</span>
          </label>
          {info?.needs_base_url && (
            <label className="block">
              <span className="text-xs text-muted-foreground font-medium">Base URL</span>
              <input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://openrouter.ai/api/v1"
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground font-mono"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium">Model</span>
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder={info?.example_model ? `vd ${info.example_model}` : ''}
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium">
              API key{form.id ? ' (để trống nếu giữ key cũ)' : ''}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium">Tên gợi nhớ (tùy chọn)</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={info?.name}
              className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            <span>Dùng làm key mặc định (Hermes trên Telegram)</span>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setForm(null)} className="px-3 py-1.5 rounded-md border border-border text-xs">
              Hủy
            </button>
            <button
              onClick={save}
              disabled={busy === 'save' || !form.model || (!form.id && !form.api_key)}
              className="flex items-center gap-1.5 bg-foreground text-background px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
            >
              {busy === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Gọi thử và lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  busy = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border disabled:opacity-50 ${
        danger ? 'border-red-500/30 text-red-500 hover:bg-red-500/10' : 'border-border hover:bg-muted'
      }`}
    >
      {busy && <Loader2 className="w-3 h-3 animate-spin" />}
      {children}
    </button>
  );
}
