'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface StatusResp {
  status:       'active' | 'inactive' | 'maintenance';
  last_seen_at: string | null;
  online:       boolean;
}

export default function MachineLiveStatus({
  machineId,
  initialLastSeenAt = null,
  className = '',
  onStatusChange,
  onLastSeenAtChange,
}: {
  machineId:          string;
  initialLastSeenAt?: string | null;
  className?:         string;
  onStatusChange?:      (online: boolean) => void;
  onLastSeenAtChange?:  (v: string | null) => void;
}) {
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(initialLastSeenAt);
  const [online,     setOnline]     = useState<boolean>(false);
  const [now,        setNow]        = useState<number | null>(null);
  const [mounted,    setMounted]    = useState(false);

  // Initialize the clock on the client only — using Date.now() during
  // SSR causes a hydration mismatch when the client re-renders a few
  // seconds later with a different "Xs ago" label.
  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
  }, []);

  // Local clock tick so the relative label updates between fetches.
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [mounted]);

  // Poll the lightweight status endpoint.
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        // ?t= busts Cloudflare edge cache — no-store alone is sometimes ignored for GET
        const res = await fetch(`/api/machine/${machineId}/status?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          console.warn('[MachineLiveStatus] status API returned', res.status, res.statusText);
          return;
        }
        const data = (await res.json()) as StatusResp;
        if (cancelled) return;
        setLastSeenAt(data.last_seen_at);
        setOnline(data.online);
        onStatusChange?.(data.online);
        onLastSeenAtChange?.(data.last_seen_at);
      } catch (err) {
        console.warn('[MachineLiveStatus] fetch error:', err);
        // Network blip — keep the previous value rather than flickering offline.
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 5_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [machineId]);

  const label = (() => {
    if (online) return 'Online';
    if (!mounted || now === null) return 'Checking…';
    if (!lastSeenAt) return 'Offline';
    const diffSec = Math.max(0, Math.floor((now - new Date(lastSeenAt).getTime()) / 1000));
    if (diffSec < 60)     return `Offline · ${diffSec}s ago`;
    if (diffSec < 3600)   return `Offline · ${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86_400) return `Offline · ${Math.floor(diffSec / 3600)}h ago`;
    return 'Offline';
  })();

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
        online
          ? 'bg-green-500/15 text-green-400 border-green-500/25'
          : 'bg-white/5 text-white/40 border-white/10'
      } ${className}`}
      title={lastSeenAt && mounted ? `Last seen ${new Date(lastSeenAt).toLocaleString()}` : 'Never seen'}
    >
      {online ? (
        <>
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
          </span>
          <Wifi size={10} aria-hidden />
        </>
      ) : (
        <WifiOff size={10} aria-hidden />
      )}
      <span>{label}</span>
    </span>
  );
}
