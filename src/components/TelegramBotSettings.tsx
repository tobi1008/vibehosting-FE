'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, ChevronDown, Eye, EyeOff, FileText, Loader2, Save, Trash2 } from 'lucide-react';

type BotConfig = {
  configured: boolean;
  source: 'web' | 'env' | null;
  bot_username: string | null;
  token_hint: string;
  butler_enabled: boolean;
  running: boolean;
  error: string;
};

const TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,}$/;

async function fetchBotConfig(): Promise<[BotConfig | null, string]> {
  try {
    const res = await fetch('/api/admin/telegram');
    const data = await res.json();
    if (!res.ok) return [null, data.error || 'Không tải được cấu hình bot'];
    return [data as BotConfig, ''];
  } catch {
    return [null, 'Không tải được cấu hình bot'];
  }
}

/** Thẻ chỉ admin thấy: nhập token bot Telegram cho Hermes, kèm hướng dẫn tạo bot với @BotFather */
export default function TelegramBotSettings({ onChange }: { onChange?: () => void }) {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const applyConfig = useCallback((data: BotConfig | null, err: string) => {
    if (data) {
      setConfig(data);
      if (!data.configured) setGuideOpen(true);
    }
    setError(err);
    setLoading(false);
  }, []);

  const load = useCallback(() => fetchBotConfig().then(([data, err]) => applyConfig(data, err)), [applyConfig]);

  useEffect(() => {
    let active = true;
    fetchBotConfig().then(([data, err]) => {
      if (active) applyConfig(data, err);
    });
    return () => {
      active = false;
    };
  }, [applyConfig]);

  // Sau khi lưu token, bot cần vài giây để bắt đầu nhận tin: kiểm tra lại cho tới khi chạy
  useEffect(() => {
    if (!config?.configured || config.running) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [config, load]);

  const save = async () => {
    const value = token.trim();
    if (!TOKEN_PATTERN.test(value)) {
      setError('Token không đúng định dạng. Token có dạng 123456789:AAH... (số, dấu hai chấm, rồi chuỗi dài).');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không lưu được token');
      setConfig(data);
      setToken('');
      setGuideOpen(false);
      setNotice(`Đã kết nối bot @${data.bot_username}. Bot sẽ bắt đầu nhận tin trong ít giây.`);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được token');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Gỡ token bot? Hermes sẽ ngừng trả lời và ngừng gửi cảnh báo trên Telegram.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/telegram', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không gỡ được token');
      setConfig(data);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gỡ được token');
    } finally {
      setBusy(false);
    }
  };

  const sendTestReport = async () => {
    setSendingReport(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/telegram/daily-report', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không gửi được báo cáo');
      setNotice('Đã gửi báo cáo hằng ngày tới Telegram của bạn. Lịch gửi tự động mỗi sáng vẫn giữ nguyên.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gửi được báo cáo');
    } finally {
      setSendingReport(false);
    }
  };

  const statusBadge = () => {
    if (!config?.configured) {
      return <span className="bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full font-medium">Chưa cấu hình</span>;
    }
    if (config.running && !config.error) {
      return (
        <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Đang chạy
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        {config.error ? 'Có lỗi' : 'Đang khởi động'}
      </span>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Cấu hình bot Telegram</h2>
            <p className="text-xs text-muted-foreground">Chỉ admin thấy mục này. Một bot dùng chung cho mọi người dùng.</p>
          </div>
        </div>
        {!loading && statusBadge()}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
        </div>
      ) : (
        <div className="space-y-4">
          {config?.configured && (
            <div className="text-sm space-y-1">
              <p className="text-foreground">
                Bot:{' '}
                {config.bot_username ? (
                  <a href={`https://t.me/${config.bot_username}`} target="_blank" rel="noopener noreferrer" className="text-[#229ED9] underline">
                    @{config.bot_username}
                  </a>
                ) : (
                  'không lấy được tên bot'
                )}
              </p>
              <p className="text-muted-foreground">
                Token: <code className="px-1 bg-muted rounded">{config.token_hint}</code>{' '}
                {config.source === 'env' ? '(lấy từ biến TELEGRAM_BOT_TOKEN trên máy chủ)' : '(nhập trên web)'}
              </p>
              {config.error && <p className="text-amber-500">Lỗi gần nhất: {config.error}</p>}
              {!config.butler_enabled && (
                <p className="text-amber-500">Máy chủ đang đặt HERMES_BUTLER=0 nên bot không chạy.</p>
              )}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={sendTestReport}
                  disabled={sendingReport}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {sendingReport ? 'Đang kiểm tra và gửi…' : 'Gửi thử báo cáo hằng ngày'}
                </button>
                <span className="text-xs text-muted-foreground">
                  Kiểm tra ngay rồi gửi tới Telegram của bạn (tài khoản phải đã liên kết).
                </span>
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setGuideOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${guideOpen ? '' : '-rotate-90'}`} />
              Hướng dẫn tạo bot và lấy token
            </button>
            {guideOpen && (
              <ol className="mt-3 ml-1 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>
                  Mở Telegram, tìm{' '}
                  <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[#229ED9] underline">
                    @BotFather
                  </a>{' '}
                  (bot chính thức, có dấu tích xanh) và bấm <b>Start</b>.
                </li>
                <li>
                  Gửi lệnh <code className="px-1 bg-muted rounded">/newbot</code>.
                </li>
                <li>Nhập tên hiển thị cho bot, ví dụ <i>Hermes Vibe Hosting</i>.</li>
                <li>
                  Nhập username cho bot, phải kết thúc bằng <code className="px-1 bg-muted rounded">bot</code>, ví dụ{' '}
                  <code className="px-1 bg-muted rounded">vibe_hermes_bot</code>.
                </li>
                <li>
                  BotFather trả về một token dạng <code className="px-1 bg-muted rounded">123456789:AAH…</code>. Sao chép token
                  đó, dán vào ô bên dưới và bấm <b>Lưu và kiểm tra</b>.
                </li>
                <li>
                  Sau khi lưu, mỗi người dùng (kể cả bạn) bấm <b>Liên kết Telegram</b> ở thẻ bên dưới để chat với Hermes.
                </li>
              </ol>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Giữ token bí mật: ai có token đều điều khiển được bot. Nếu lỡ lộ, gửi <code className="px-1 bg-muted rounded">/revoke</code>{' '}
              cho @BotFather để lấy token mới rồi dán lại vào đây.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder={config?.configured ? 'Dán token mới để thay bot' : '123456789:AAH...'}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-[#229ED9]/40"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showToken ? 'Ẩn token' : 'Hiện token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={save}
              disabled={busy || !token.trim()}
              className="flex items-center justify-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#229ED9] text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu và kiểm tra
            </button>
            {config?.source === 'web' && (
              <button
                onClick={remove}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Gỡ token
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
