'use client';

import { useSearchParams } from 'next/navigation';
import { RotateCcw, Home, ChevronLeft } from 'lucide-react';

export default function KioskNav() {
  const params = useSearchParams();
  const machineId = params.get('machine');

  if (!machineId) return null;

  const homeUrl = `${window.location.origin}/?machine=${machineId}`;

  return (
    <>
    <div className="h-[60px]" />
    <div className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center justify-around
      bg-black/80 backdrop-blur-md border-t border-white/10 px-6 py-3 safe-area-bottom">
      <button
        onClick={() => window.history.back()}
        className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl
          text-white/50 hover:text-white active:text-coffee-400
          hover:bg-white/8 active:bg-white/12 transition-all"
      >
        <ChevronLeft size={22} />
        <span className="text-[10px] tracking-widest uppercase">Back</span>
      </button>

      <button
        onClick={() => { window.location.href = homeUrl; }}
        className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl
          text-coffee-400 hover:text-coffee-300 active:text-coffee-200
          hover:bg-coffee-500/10 active:bg-coffee-500/15 transition-all"
      >
        <Home size={22} />
        <span className="text-[10px] tracking-widest uppercase">Home</span>
      </button>

      <button
        onClick={() => window.location.reload()}
        className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl
          text-white/50 hover:text-white active:text-coffee-400
          hover:bg-white/8 active:bg-white/12 transition-all"
      >
        <RotateCcw size={22} />
        <span className="text-[10px] tracking-widest uppercase">Refresh</span>
      </button>
    </div>
    </>
  );
}
