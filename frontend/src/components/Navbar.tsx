'use client';

import Link from 'next/link';
import { useSession, signOut, signIn } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { Triangle, LogOut, User, Users, ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isExitingImpersonation, setIsExitingImpersonation] = useState(false);

  const isImpersonating = Boolean((session?.user as any)?.isImpersonating);
  const isAdmin = (session?.user as any)?.role === 'admin';

  const handleExitImpersonation = async () => {
    setIsExitingImpersonation(true);
    try {
      const res = await fetch('/api/admin/impersonate', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.impersonateUserId && data.impersonateToken) {
        await signIn('credentials', {
          redirect: false,
          impersonateUserId: data.impersonateUserId,
          impersonateToken: data.impersonateToken,
        });
        window.location.href = '/admin/users';
      } else {
        // Fallback to sign out
        await signOut({ callbackUrl: '/login' });
      }
    } catch {
      await signOut({ callbackUrl: '/login' });
    } finally {
      setIsExitingImpersonation(false);
    }
  };

  const navLinks = [
    { href: '/', label: 'Overview' },
    { href: '/profile', label: 'Profile' },
    ...(isAdmin && !isImpersonating ? [{ href: '/admin/users', label: 'Users' }] : []),
    { href: '#', label: 'Integrations' },
    { href: '#', label: 'Activity' },
    { href: '#', label: 'Domains' },
    { href: '#', label: 'Usage' },
    { href: '#', label: 'Settings' },
  ];

  if (!session) return null;

  return (
    <div className="w-full border-b border-border bg-background">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-500 px-6 py-2.5 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
            <span>
              Impersonation Mode: Logged in as <strong className="font-semibold text-amber-400">{session.user?.name || session.user?.email}</strong>
            </span>
          </div>
          <button
            onClick={handleExitImpersonation}
            disabled={isExitingImpersonation}
            className="flex items-center gap-1.5 bg-amber-500 text-black hover:bg-amber-400 px-3 py-1 rounded-md text-xs font-semibold transition-all shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isExitingImpersonation ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5" />
            )}
            Return to Admin
          </button>
        </div>
      )}

      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center rounded-md">
              <Triangle className="w-4 h-4 fill-current" />
            </div>
            <span className="text-xl text-muted-foreground">/</span>
            <span className="font-semibold">{session.user?.name || session.user?.email}</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border hover:border-foreground transition-colors"
            >
              {session.user?.image ? (
                <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold">{session.user?.name?.[0] || 'U'}</span>
              )}
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-md shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-sm font-medium truncate">{session.user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.user?.email}</p>
                  <span
                    className={`inline-block mt-1 text-[9px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                      isAdmin
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                    }`}
                  >
                    {(session.user as any)?.role || 'USER'}
                  </span>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile & GitHub
                </Link>

                {isAdmin && !isImpersonating && (
                  <Link
                    href="/admin/users"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <Users className="w-4 h-4 text-amber-500" />
                    Manage Users
                  </Link>
                )}

                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-muted flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 px-6 overflow-x-auto no-scrollbar">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.label}
              href={link.href}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
