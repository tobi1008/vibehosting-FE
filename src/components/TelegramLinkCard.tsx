'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Send, Unlink } from 'lucide-react';

type TelegramStatus = {
  configured: boolean;
  linked: boolean;
  bot_username: string | null;
  chats: { telegram_name: string; linked_at: number }[];
};

type LinkCode = { code: string; link: string | null; expires_in: number; bot_username: string | null };

async function fetchTelegramStatus(): Promise<[TelegramStatus | null, string]> {
  try {
    const res = await fetch('/api/user/telegram');
    const data = await res.json();
    if (!res.ok) return [null, data.error || 'Không tải được trạng thái Telegram'];
    return [data as TelegramStatus, ''];
  } catch {
    return [null, 'Không tải được trạng thái Telegram'];
  }
}

/** Thẻ liên kết Telegram với Hermes Butler (chat để debug, nhận cảnh báo và báo cáo hằng ngày) */
export default function TelegramLinkCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const applyStatus = useCallback((data: TelegramStatus | null, err: string) => {
    if (data) {
      setStatus(data);
      if (data.linked) setLinkCode(null);
    }
    setError(err);
    setLoading(false);
  }, []);

  const loadStatus = useCallback(
    () => fetchTelegramStatus().then(([data, err]) => applyStatus(data, err)),
    [applyStatus],
  );

  useEffect(() => {
    let active = true;
    fetchTelegramStatus().then(([data, err]) => {
      if (active) applyStatus(data, err);
    });
    return () => {
      active = false;
    };
  }, [applyStatus]);

  // Trong lúc chờ người dùng mở bot, kiểm tra lại mỗi 5 giây để cập nhật "Đã liên kết"
  useEffect(() => {
    if (!linkCode) return;
    const timer = setInterval(loadStatus, 5000);
    return () => clearInterval(timer);
  }, [linkCode, loadStatus]);

  const createCode = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/user/telegram', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không tạo được mã liên kết');
      setLinkCode(data);
      if (data.link) window.open(data.link, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được mã liên kết');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!confirm('Hủy liên kết Telegram? Hermes sẽ không gửi cảnh báo cho bạn nữa.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/user/telegram', { method: 'DELETE' });
      if (!res.ok) throw new Error('Không hủy được liên kết');
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không hủy được liên kết');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#229ED9] text-white flex items-center justify-center shadow-md">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Hermes trên Telegram</h2>
            <p className="text-xs text-muted-foreground">
              Chat với Hermes để kiểm tra, debug ứng dụng và nhận cảnh báo khi ứng dụng gặp sự cố.
            </p>
          </div>
        </div>
        {status?.linked ? (
          <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Đã liên kết
          </span>
        ) : (
          <span className="bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full font-medium">Chưa liên kết</span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2.5 rounded-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
        </div>
      ) : status && !status.configured ? (
        <p className="text-sm text-muted-foreground">Máy chủ chưa bật bot Telegram.</p>
      ) : status?.linked ? (
        <div className="space-y-3">
          {status.chats.map((c) => (
            <div key={c.linked_at} className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>
                {c.telegram_name ? `@${c.telegram_name}` : 'Tài khoản Telegram'} – liên kết ngày{' '}
                {new Date(c.linked_at * 1000).toLocaleDateString('vi-VN')}
              </span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {status.bot_username && (
              <a
                href={`https://t.me/${status.bot_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#229ED9] text-white hover:opacity-90"
              >
                <ExternalLink className="w-4 h-4" /> Mở chat với Hermes
              </a>
            )}
            <button
              onClick={unlink}
              disabled={busy}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-red-500 disabled:opacity-50"
            >
              <Unlink className="w-4 h-4" /> Hủy liên kết
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={createCode}
            disabled={busy}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#229ED9] text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Liên kết Telegram
          </button>
          {linkCode && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Telegram đã được mở trong tab mới, bấm <b>Start</b> trong chat với bot để hoàn tất. Nếu tab không mở,{' '}
                {linkCode.link ? (
                  <a href={linkCode.link} target="_blank" rel="noopener noreferrer" className="text-[#229ED9] underline">
                    bấm vào đây
                  </a>
                ) : (
                  <>gửi lệnh <code className="px-1 bg-muted rounded">/start {linkCode.code}</code> cho bot</>
                )}
                .
              </p>
              <p className="text-xs">Mã có hiệu lực trong {Math.round(linkCode.expires_in / 60)} phút.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
