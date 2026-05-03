'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils/cn';

type LiveStatus =
  | 'pending'
  | 'paid'
  | 'dispensing'
  | 'dispensed'
  | 'failed'
  | 'refunded';

export default function PaymentSuccess({
  drink,
  paymentId,
  amountPaise,
  orderId,
}: {
  drink:       'coffee' | 'tea';
  paymentId:   string;
  amountPaise: number;
  orderId?:    string;
}) {
  // Poll the order's real status so the screen flips from
  // "Brewing…" to "Completed" once the ESP acks the dispense.
  // Without this poll the UI sat on "Brewing…" forever even after
  // the machine had finished and acked.
  const [status, setStatus] = useState<LiveStatus>('paid');

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await fetch(`/api/order/${orderId}/status`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { status: LiveStatus };
        if (!cancelled && j.status) setStatus(j.status);
      } catch { /* ignore — next tick will retry */ }
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId]);

  const done   = status === 'dispensed';
  const failed = status === 'failed';

  const headline =
    done   ? 'Your drink is ready!' :
    failed ? 'Something went wrong' :
             'Payment successful!';

  const subline =
    done   ? `Please collect your ${drink === 'coffee' ? '☕ filter coffee' : '🍵 tea'} at the dispensing slot.` :
    failed ? 'The machine could not complete this order. Please contact staff.' :
             `Your ${drink === 'coffee' ? '☕ filter coffee' : '🍵 tea'} is being brewed.`;

  const Icon      = failed ? XCircle : CheckCircle2;
  const iconColor = failed ? 'text-red-400'    : 'text-emerald-400';
  const iconBg    = failed ? 'bg-red-500/15 border-red-500/30'
                           : 'bg-emerald-500/15 border-emerald-500/30';
  const barColor  = failed ? 'bg-red-500' : 'bg-emerald-500';
  const barWidth  = done || failed ? '100%' : '85%';
  const stepLabel = done   ? 'Completed'
                  : failed ? 'Failed'
                  : 'Brewing…';

  return (
    <div className="flex flex-col items-center text-center pt-10 pb-6">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={`w-20 h-20 rounded-full border flex items-center justify-center mb-6 ${iconBg}`}
      >
        <Icon size={40} className={iconColor} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold text-white mb-2">{headline}</h2>
        <p className="text-white/40 text-sm mb-8">{subline}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="w-full max-w-xs mb-8"
      >
        <div className="flex items-center justify-between text-xs text-white/30 mb-2">
          <span>Payment verified</span>
          <span>{stepLabel}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: '30%' }}
            animate={{ width: barWidth }}
            transition={{ duration: done || failed ? 0.6 : 10, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-4 w-full max-w-xs text-left"
      >
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/40">Amount</span>
          <span className="text-white font-semibold">{formatPrice(amountPaise)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/30">Payment ID</span>
          <span className="text-white/50 font-mono">{paymentId.slice(-12)}</span>
        </div>
      </motion.div>
    </div>
  );
}
