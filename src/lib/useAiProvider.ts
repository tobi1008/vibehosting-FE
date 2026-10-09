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
    description: 'Thực thi CLI trực tiếp trên VPS, tự động dự phòng 5 tầng Gemini Flash',
    models: [
      'gemini-3.7-flash-high',
      'gemini-3.7-flash-medium',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ],
  },
  {
    id: 'hermes',
    name: 'Hermes Agent (Open-Source LLMs)',
    badge: 'Mô hình mã nguồn mở',
    description: 'Bộ não suy luận Hermes nguyên bản gọi qua API Gateway nội bộ',
    models: [
      'stepfun/step-3.7-flash:free',
      'poolside/laguna-s-2.1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
    ],
  },
];

const STORAGE_KEY = 'vibe_ai_provider';
const SYNC_EVENT = 'vibe_ai_provider_change';

export function useAiProvider() {
  const [selectedProvider, setSelectedProviderState] = useState<string>('agy');
  const [providers, setProviders] = useState<AiProvider[]>(FALLBACK_AI_PROVIDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial read from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSelectedProviderState(saved);
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
          setProviders(data.providers);
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
