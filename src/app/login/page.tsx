'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Triangle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import Link from 'next/link';

export default function Login() {
  const { status } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const res = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    if (res?.error) {
      setError('Invalid username or password');
      setIsLoading(false);
    } else {
      router.push('/');
    }
  };

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[100px]"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card/50 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-foreground text-background flex items-center justify-center rounded-xl mb-6 shadow-lg shadow-foreground/20">
            <Triangle className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Welcome Back</h1>
          <p className="text-muted-foreground text-center text-sm">Enter your credentials to access the dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2.5 rounded-md text-center">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all text-sm"
              placeholder="admin"
              required
            />
          </div>

          <div className="flex flex-col gap-2 mb-2">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground focus:ring-1 focus:ring-foreground transition-all text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 py-2.5 px-4 rounded-lg font-medium transition-all shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are managed by the administrator.
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-4">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
