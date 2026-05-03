'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { DrinkType, DrinkCustomization } from '@/types';

interface Props {
  drink: DrinkType;
  customization: DrinkCustomization;
  orderId: string;
}

const STEPS = [
  '✓ Payment confirmed',
  '☕ Preparing your drink',
  '🟢 Dispensing...',
  '🎉 Ready to pick up!',
];

export function SuccessScreen({ drink, customization, orderId }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      if (i === 0) return;
      timers.push(setTimeout(() => setStepIdx(i), i * 1500));
    });
    timers.push(setTimeout(() => setDone(true), STEPS.length * 1500 + 500));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="pt-8 flex flex-col items-center text-center">
      {/* Animated cup */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-7xl mb-6"
      >
        {drink === 'coffee' ? '☕' : '🍵'}
      </motion.div>

      <h2 className="text-2xl font-bold mb-2">
        {done ? 'Enjoy your drink!' : 'Processing order…'}
      </h2>
      <p className="text-[#7a7062] text-sm mb-8">
        {customization.size === 'large' ? 'Large' : customization.size === 'small' ? 'Small' : 'Regular'}{' '}
        {drink} · {customization.strength} · {customization.sugar === 'none' ? 'No sugar' : customization.sugar + ' sugar'}
      </p>

      {/* Progress steps */}
      <div className="w-full space-y-3 mb-8">
        {STEPS.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: i <= stepIdx ? 1 : 0.2, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
              ${i <= stepIdx
                ? 'border-[#c8861a]/30 bg-[#c8861a]/5 text-[#f0ece4]'
                : 'border-[#2e2e2e] bg-[#1a1a1a] text-[#3e3e3e]'
              }`}
          >
            {s}
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-[#3e3e3e]">Order #{orderId.slice(-8).toUpperCase()}</p>
    </div>
  );
}
