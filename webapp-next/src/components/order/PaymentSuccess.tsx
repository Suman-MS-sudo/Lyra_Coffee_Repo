'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { formatPrice, cap } from '@/lib/utils/cn';

export default function PaymentSuccess({
  drink,
  paymentId,
  amountPaise,
}: {
  drink:       'coffee' | 'tea';
  paymentId:   string;
  amountPaise: number;
}) {
  return (
    <div className="flex flex-col items-center text-center pt-10 pb-6">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30
          flex items-center justify-center mb-6"
      >
        <CheckCircle2 size={40} className="text-emerald-400" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold text-white mb-2">Payment successful!</h2>
        <p className="text-white/40 text-sm mb-8">
          Your {drink === 'coffee' ? '☕ filter coffee' : '🍵 tea'} is being brewed.<br />
          Please collect it at the dispensing slot.
        </p>
      </motion.div>

      {/* Progress animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="w-full max-w-xs mb-8"
      >
        <div className="flex items-center justify-between text-xs text-white/30 mb-2">
          <span>Payment verified</span>
          <span>Brewing…</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500 rounded-full"
            initial={{ width: '30%' }}
            animate={{ width: '85%' }}
            transition={{ duration: 10, ease: 'easeOut', delay: 0.5 }}
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
