'use client';

import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let listeners: ((t: Toast) => void)[] = [];

export function useToast() {
  const toast = useCallback(
    ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
      const t: Toast = { id: String(Date.now()), title, description, variant };
      listeners.forEach(l => l(t));
    },
    []
  );
  return { toast };
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Toast) => {
    setToasts(prev => [...prev, t]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== t.id));
    }, 4000);
  }, []);

  // Register/unregister listener
  useState(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter(l => l !== addToast);
    };
  });

  return toasts;
}
