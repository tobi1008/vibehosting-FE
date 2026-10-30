'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AiProvider {
  id: string;
  name: string;
  badge: string;
  description: string;
  models?: string[];
}

export const FALLBACK_AI_PROVIDERS: AiProvider[] = [
  {
    id: 'agy',
    name: 'Google Antigravity (Gemini Flash)',
    badge: 'Khuyên dùng - Nhanh (5-15s)',
    description: 'Viết cấu hình Nixpacks & K3s bằng CLI trên VPS, tự động dự phòng 3 tầng Gemini 3.8 Flash',
    models: [
      'gemini-3.8-flash-low',
      'gemini-3.8-flash-medium',
      'gemini-3.8-flash-high',
    ],
  },
  {
    id: 'claude',
    name: 'Claude Code (Anthropic Opus/Sonnet)',
    badge: 'Trí tuệ cao cấp (Opus 5.5)',
    description: 'Viết cấu hình Nixpacks & K3s bằng Claude Code CLI trên VPS với Opus 5.5, Sonnet 5.5, Haiku 5.5',
    models: [
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'claude-haiku-5-5',
    ],
  },
];

const STORAGE_KEY = 'vibe_ai_provider';
// Engine được phép viết cấu hình. Lựa chọn cũ (vd: 'hermes') sẽ quay về mặc định
const CONFIG_ENGINE_IDS = FALLBACK_AI_PROVIDERS.map((p) => p.id);
const SYNC_EVENT = 'vibe_ai_provider_change';

export function useAiProvider() {
  const [selectedProvider, setSelectedProviderState] = useState<string>('agy');
  const [providers, setProviders] = useState<AiProvider[]>(FALLBACK_AI_PROVIDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial read from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CONFIG_ENGINE_IDS.includes(saved)) {
        setSelectedProviderState(saved);
      } else if (saved) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }

    // 2. Fetch live providers list from API
    let isMounted = true;
    fetch('/api/ai-providers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (Array.isArray(data.providers) && data.providers.length > 0) {
          const mergedProviders: AiProvider[] = data.providers.filter((p: AiProvider) => p.id !== 'hermes');
          const hasClaude = mergedProviders.some((p) => p.id === 'claude');
          if (!hasClaude) {
            const claudeDef = FALLBACK_AI_PROVIDERS.find((p) => p.id === 'claude');
            if (claudeDef) {
              const agyIndex = mergedProviders.findIndex((p) => p.id === 'agy');
              if (agyIndex !== -1) {
                mergedProviders.splice(agyIndex + 1, 0, claudeDef);
              } else {
                mergedProviders.push(claudeDef);
              }
            }
          }
          setProviders(mergedProviders);
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved && data.default) {
            setSelectedProviderState(data.default);
          }
        }
      })
      .catch((err) => {
        console.warn('Cannot fetch AI providers from API, using fallback:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 3. Sync state across components when changed
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setSelectedProviderState(customEvent.detail);
      }
    };

    window.addEventListener(SYNC_EVENT, handleSync);
    return () => {
      isMounted = false;
      window.removeEventListener(SYNC_EVENT, handleSync);
    };
  }, []);

  const setProvider = useCallback((id: string) => {
    setSelectedProviderState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: id }));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const currentProvider =
    providers.find((p) => p.id === selectedProvider) ||
    FALLBACK_AI_PROVIDERS.find((p) => p.id === selectedProvider) ||
    providers[0] ||
    FALLBACK_AI_PROVIDERS[0];

  return {
    selectedProvider,
    setProvider,
    providers,
    currentProvider,
    loading,
  };
}
