'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2, Plug } from 'lucide-react';
import TelegramLinkCard from '@/components/TelegramLinkCard';
import TelegramBotSettings from '@/components/TelegramBotSettings';
import AiCredentialsCard from '@/components/AiCredentialsCard';

type Profile = {
  role: string;
  githubUsername: string | null;
  githubAvatar: string | null;
  isGithubConnected: boolean;
};

function GithubMark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/** Trung tâm tích hợp: GitHub (mã nguồn, CI/CD), Telegram (Hermes), key AI riêng */
export default function IntegrationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [telegramRefresh, setTelegramRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    fetch('/api/user/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && setProfile(d))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Plug className="w-8 h-8" /> Integrations
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kết nối GitHub để triển khai và CI/CD, Telegram để trò chuyện với Hermes, và API key AI của riêng bạn.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* GitHub */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <GithubMark />
            <h2 className="text-lg font-semibold text-foreground">GitHub</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Dùng để chọn repository khi triển khai, đẩy code sửa từ File Manager / AI Debug và tự đăng ký webhook CI/CD.
          </p>
          {!profile ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : profile.isGithubConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Đã kết nối
                <a
                  href={`https://github.com/${profile.githubUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline inline-flex items-center gap-1"
                >
                  @{profile.githubUsername} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Link href="/profile" className="text-xs border border-border hover:bg-muted px-3 py-1.5 rounded-md self-start">
                Quản lý / repository
              </Link>
            </div>
          ) : (
            <a
              href="/api/user/github/connect?returnTo=/integrations"
              className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium"
            >
              <GithubMark className="w-4 h-4" /> Kết nối GitHub
            </a>
          )}
        </div>

        {/* Telegram / Hermes */}
        {isAdmin && <TelegramBotSettings onChange={() => setTelegramRefresh((n) => n + 1)} />}
        <TelegramLinkCard isAdmin={isAdmin} refreshKey={telegramRefresh} />

        {/* Key AI riêng */}
        <AiCredentialsCard />
      </div>
    </div>
  );
}
