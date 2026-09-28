'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8 text-center"
      >
        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-xl mx-auto mb-5 border border-amber-500/20">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Registration Disabled</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Public user registration is currently disabled. Accounts are provisioned and managed directly by the system administrator.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 py-2.5 px-5 rounded-lg text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
        <p className="text-xs text-muted-foreground/60 mt-4">
          Redirecting to login in a few seconds...
        </p>
      </motion.div>
    </div>
  );
}
