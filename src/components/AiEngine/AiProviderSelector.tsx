'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Zap,
  Cpu,
  CheckCircle2,
  ChevronDown,
  Layers,
  Check,
} from 'lucide-react';
import { useAiProvider, AiProvider } from '@/lib/useAiProvider';

interface AiProviderSelectorProps {
  variant?: 'cards' | 'toggle' | 'dropdown';
  className?: string;
  // Optional controlled props if parent wants to override
  value?: string;
  onChange?: (providerId: string) => void;
  // Label customizer
  title?: string;
  subtitle?: string;
}

export function AiProviderSelector({
  variant = 'cards',
  className = '',
  value,
  onChange,
  title = 'AI Engine Triển khai & Cấu hình',
  subtitle = 'Chọn mô hình AI hỗ trợ phân tích, build và cấu hình hạ tầng K3s',
}: AiProviderSelectorProps) {
  const {
    selectedProvider: hookProvider,
    setProvider: hookSetProvider,
    providers,
    currentProvider,
  } = useAiProvider();

  const selected = value !== undefined ? value : hookProvider;
  const handleSelect = (id: string) => {
    if (onChange) {
      onChange(id);
    }
    hookSetProvider(id);
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // ----------------------------------------------------------------------
  // VARIANT: DROPDOWN
  // ----------------------------------------------------------------------
  if (variant === 'dropdown') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card hover:bg-muted/60 border border-border text-xs font-medium text-foreground transition-all shadow-xs"
          title="Thay đổi AI Engine"
        >
          {selected === 'agy' ? (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
          )}
          <span className="font-semibold truncate max-w-[150px]">
            {selected === 'agy' ? 'Google Antigravity' : 'Hermes Agent'}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${
              selected === 'agy'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
            }`}
          >
            {selected === 'agy' ? 'Khuyên dùng' : 'Open-Source'}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-72 rounded-xl bg-card border border-border shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border/60">
              Chọn AI Reasoning Engine
            </div>
            {providers.map((p) => {
              const isSelected = selected === p.id;
              const isAgy = p.id === 'agy';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    handleSelect(p.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-muted/80 text-foreground ring-1 ring-border'
                      : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-md shrink-0 mt-0.5 ${
                      isAgy
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-indigo-500/15 text-indigo-400'
                    }`}
                  >
                    {isAgy ? <Sparkles className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {p.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
                    </div>
                    <span
                      className={`inline-block text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 ${
                        isAgy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {p.badge}
                    </span>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-snug">
                      {p.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // VARIANT: TOGGLE (Segmented Pill Buttons)
  // ----------------------------------------------------------------------
  if (variant === 'toggle') {
    return (
      <div className={`inline-flex items-center p-1 rounded-xl bg-muted/40 border border-border/80 ${className}`}>
        {providers.map((p) => {
          const isSelected = selected === p.id;
          const isAgy = p.id === 'agy';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-background text-foreground shadow-xs border border-border font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent'
              }`}
            >
              {isAgy ? (
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    isSelected ? 'text-emerald-400' : 'text-muted-foreground'
                  }`}
                />
              ) : (
                <Bot
                  className={`w-3.5 h-3.5 ${
                    isSelected ? 'text-indigo-400' : 'text-muted-foreground'
                  }`}
                />
              )}
              <span>{isAgy ? 'Google Antigravity' : 'Hermes Agent'}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isAgy
                    ? isSelected
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-muted text-muted-foreground'
                    : isSelected
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isAgy ? 'Gemini Flash' : 'Open-Source'}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // ----------------------------------------------------------------------
  // VARIANT: CARDS (Radio Cards in Deploy Forms)
  // ----------------------------------------------------------------------
  return (
    <div className={`flex flex-col gap-3 pt-4 border-t border-border ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-2 text-foreground">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span>{title}</span>
        </label>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          {subtitle}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {providers.map((p) => {
          const isSelected = selected === p.id;
          const isAgy = p.id === 'agy';
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                isSelected
                  ? isAgy
                    ? 'border-emerald-500/60 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30'
                    : 'border-indigo-500/60 bg-indigo-500/5 shadow-xs ring-1 ring-indigo-500/30'
                  : 'border-border bg-background hover:border-foreground/30 text-muted-foreground'
              }`}
            >
              <div>
                <div className="flex items-center justify-between w-full mb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isAgy
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                      }`}
                    >
                      {isAgy ? (
                        <Sparkles className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        {p.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSelected ? (
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          isAgy ? 'text-emerald-400' : 'text-indigo-400'
                        }`}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border" />
                    )}
                  </div>
                </div>

                <div className="mb-2">
                  <span
                    className={`inline-block text-[11px] px-2 py-0.5 rounded-md font-mono font-medium ${
                      isAgy
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>

              {p.models && p.models.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-muted-foreground/80 font-mono">
                    Models:
                  </span>
                  {p.models.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="text-[10px] px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground font-mono"
                    >
                      {m.split('/').pop()?.replace(':free', '') || m}
                    </span>
                  ))}
                  {p.models.length > 2 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      +{p.models.length - 2}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
