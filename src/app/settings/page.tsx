'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LogOut, Palette, Settings, ShieldCheck, User } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

type Profile = { username: string; name: string | null; email: string | null; role: string; createdAt: string };

function Notice({ kind, text }: { kind: 'ok' | 'error'; text: string }) {
  return (
    <div
      className={`text-sm px-3 py-2 rounded-md flex items-center gap-2 border ${
        kind === 'ok'
          ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
          : 'bg-red-500/10 border-red-500/20 text-red-500'
      }`}
    >
      {kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {text}
    </div>
  );
}

const inputClass =
  'mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground';

/** Cài đặt tài khoản: thông tin, mật khẩu, giao diện, phiên đăng nhập */
export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/user/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Profile | null) => {
        if (!active || !d) return;
        setProfile(d);
        setName(d.name || '');
        setEmail(d.email || '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Không lưu được thông tin');
      setProfile((p) => (p ? { ...p, name: data.name, email: data.email } : p));
      setProfileNotice({ kind: 'ok', text: 'Đã lưu thông tin tài khoản.' });
    } catch (err) {
      setProfileNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (next !== confirm) {
      setPasswordNotice({ kind: 'error', text: 'Mật khẩu nhập lại không khớp.' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Không đổi được mật khẩu');
      setCurrent('');
      setNext('');
      setConfirm('');
      setPasswordNotice({ kind: 'ok', text: 'Đã đổi mật khẩu.' });
    } catch (err) {
      setPasswordNotice({ kind: 'error', text: (err as Error).message });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Settings className="w-8 h-8" /> Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Thông tin tài khoản, mật khẩu và giao diện.</p>
      </div>

      <div className="flex flex-col gap-6">
        <form onSubmit={saveProfile} className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5" /> Tài khoản
          </h2>
          {!profile ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Tên đăng nhập</span>
                  <p className="font-mono mt-1">@{profile.username}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Vai trò · ngày tạo</span>
                  <p className="mt-1">
                    {profile.role === 'admin' ? 'Admin' : 'Người dùng'} ·{' '}
                    {new Date(profile.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
              <label className="block">
                <span className="text-xs text-muted-foreground font-medium">Tên hiển thị</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} maxLength={60} />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground font-medium">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
              {profileNotice && <Notice {...profileNotice} />}
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />} Lưu thông tin
              </button>
            </>
          )}
        </form>

        <form onSubmit={savePassword} className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Đổi mật khẩu
          </h2>
          <label className="block">
            <span className="text-xs text-muted-foreground font-medium">Mật khẩu hiện tại</span>
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
              required
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-muted-foreground font-medium">Mật khẩu mới (tối thiểu 8 ký tự)</span>
              <input
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                minLength={8}
                onChange={(e) => setNext(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground font-medium">Nhập lại mật khẩu mới</span>
              <input
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                required
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-xs text-muted-foreground inline-flex items-center gap-1"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {show ? 'Ẩn' : 'Hiện'} mật khẩu
          </button>
          {passwordNotice && <Notice {...passwordNotice} />}
          <button
            type="submit"
            disabled={savingPassword}
            className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />} Đổi mật khẩu
          </button>
        </form>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5" /> Giao diện
          </h2>
          <p className="text-sm text-muted-foreground">Chọn sáng, tối hoặc theo hệ thống. Lựa chọn lưu trên trình duyệt này.</p>
          <ThemeToggle variant="segmented" />
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Phiên đăng nhập</h2>
            <p className="text-sm text-muted-foreground">Đăng xuất khỏi Vibe Hosting trên trình duyệt này.</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-md text-sm font-medium self-start"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
