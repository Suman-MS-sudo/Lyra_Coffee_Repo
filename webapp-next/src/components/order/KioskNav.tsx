'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { RotateCcw, Home, ChevronLeft } from 'lucide-react';

export default function KioskNav() {
  const params = useSearchParams();
  const machineId = params.get('machine');

  // Block all links that navigate outside this app
  useEffect(() => {
    if (!machineId) return;
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      const isExternal = /^https?:\/\//.test(href) && !href.startsWith(window.location.origin);
      const isScheme = /^(mailto|tel|sms):/.test(href);
      if (isExternal || isScheme) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [machineId]);

  if (!machineId) return null;

  function goHome() {
    window.location.href = `${window.location.origin}/?machine=${machineId}`;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999]"
      style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-around px-4 py-2">
        <button
          onClick={() => window.history.back()}
          className="flex flex-col items-center gap-1 min-w-[80px] py-3 px-4 rounded-2xl
            text-white/40 active:text-white active:bg-white/10 transition-all"
        >
          <ChevronLeft size={24} strokeWidth={2} />
          <span className="text-[9px] font-semibold tracking-[0.2em] uppercase">Back</span>
        </button>

        <button
          onClick={goHome}
          className="flex flex-col items-center gap-1 min-w-[80px] py-3 px-4 rounded-2xl
            text-coffee-400 active:text-coffee-300 active:bg-coffee-500/15 transition-all"
        >
          <Home size={24} strokeWidth={2} />
          <span className="text-[9px] font-semibold tracking-[0.2em] uppercase">Home</span>
        </button>

        <button
          onClick={() => window.location.reload()}
          className="flex flex-col items-center gap-1 min-w-[80px] py-3 px-4 rounded-2xl
            text-white/40 active:text-white active:bg-white/10 transition-all"
        >
          <RotateCcw size={24} strokeWidth={2} />
          <span className="text-[9px] font-semibold tracking-[0.2em] uppercase">Refresh</span>
        </button>
      </div>
    </div>
  );
}
