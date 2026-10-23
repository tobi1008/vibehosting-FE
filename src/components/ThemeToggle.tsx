'use client';

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '@/lib/ThemeContext';

interface ThemeToggleProps {
  variant?: 'segmented' | 'icon';
  className?: string;
}

export function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={resolvedTheme === 'dark' ? 'Chuyển sang giao diện Sáng (Light Mode)' : 'Chuyển sang giao diệnối (Dark Mode)'}
        aria-label="Toggle theme"
        className={`w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-all shadow-xs active:scale-95 ${className}`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-200 hover:-rotate-12" />
        )}
      </button>
    );
  }

  const options: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Sáng', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'dark', label: 'Tối', icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'system', label: 'Hệ thống', icon: <Monitor className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-full bg-muted/70 border border-border ${className}`}
      role="group"
      aria-label="Chọn giao diện Sáng / Tối"
    >
      {options.map((opt) => {
        const isActive = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            title={`Giao diện: ${opt.label}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              isActive
                ? 'bg-card text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            <span
              className={
                isActive
                  ? opt.id === 'light'
                    ? 'text-amber-500'
                    : opt.id === 'dark'
                    ? 'text-indigo-400'
                    : 'text-emerald-500'
                  : ''
              }
            >
              {opt.icon}
            </span>
            <span className="hidden sm:inline text-[11px]">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
