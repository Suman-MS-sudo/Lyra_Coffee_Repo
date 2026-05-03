'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/hooks/use-toast';

export function Toaster() {
  const toasts = useToastStore();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`rounded-xl border px-4 py-3 shadow-lg pointer-events-auto
              ${t.variant === 'destructive'
                ? 'bg-red-950 border-red-800 text-red-100'
                : 'bg-[#1a1a1a] border-[#2e2e2e] text-[#f0ece4]'
              }`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && (
              <p className="text-xs mt-0.5 opacity-80">{t.description}</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
