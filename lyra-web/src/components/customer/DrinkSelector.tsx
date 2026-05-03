'use client';

import type { DrinkType } from '@/types';
import { motion } from 'framer-motion';

const DRINKS: { type: DrinkType; label: string; emoji: string; desc: string }[] = [
  { type: 'coffee', label: 'Coffee', emoji: '☕', desc: 'Rich espresso-based decoction' },
  { type: 'tea',    label: 'Tea',    emoji: '🍵', desc: 'Aromatic brew from select leaves' },
];

interface Props {
  selected: DrinkType;
  onSelect: (d: DrinkType) => void;
  onNext: () => void;
}

export function DrinkSelector({ selected, onSelect, onNext }: Props) {
  return (
    <div className="pt-4">
      <h2 className="text-lg font-semibold mb-1">Choose your drink</h2>
      <p className="text-[#7a7062] text-sm mb-6">Select what you'd like to order</p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {DRINKS.map(d => (
          <button
            key={d.type}
            onClick={() => onSelect(d.type)}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 p-6 text-center transition-all duration-200 active:scale-95
              ${selected === d.type
                ? 'border-[#c8861a] bg-[#c8861a]/10 shadow-lg shadow-[#c8861a]/10'
                : 'border-[#2e2e2e] bg-[#1a1a1a] hover:border-[#3e3e3e]'
              }`}
          >
            {selected === d.type && (
              <motion.div
                layoutId="drink-highlight"
                className="absolute inset-0 rounded-2xl bg-[#c8861a]/5"
                transition={{ duration: 0.2 }}
              />
            )}
            <span className="text-3xl mb-3 relative z-10">{d.emoji}</span>
            <span className="font-semibold text-base relative z-10">{d.label}</span>
            <span className="text-[#7a7062] text-xs mt-1 relative z-10">{d.desc}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl bg-[#c8861a] text-[#0a0a0a] font-semibold text-base active:scale-[0.98] transition-transform"
      >
        Customise →
      </button>
    </div>
  );
}
