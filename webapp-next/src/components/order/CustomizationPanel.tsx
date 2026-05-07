'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { DrinkCustomization } from '@/lib/types/database';
import { cn } from '@/lib/utils/cn';

import type { DrinkType } from '@/lib/types/database';

interface Props {
  drink:   DrinkType;
  initial: DrinkCustomization;
  onBack:  () => void;
  onNext:  (c: DrinkCustomization) => void;
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label:    string;
  options:  { value: T; label: string; icon?: string }[];
  value:    T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-2xl text-xs sm:text-sm font-medium text-center',
              'border transition-all duration-150 select-none active:scale-95',
              value === o.value
                ? 'bg-coffee-500 border-coffee-500 text-white shadow-glow-amber'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30',
            )}
          >
            {o.icon && <span className="text-base leading-none">{o.icon}</span>}
            <span className="leading-tight whitespace-pre-line">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MilkToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
        Milk
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: true,  label: 'With milk',    icon: '🥛' },
          { value: false, label: 'No milk',      icon: '🖤' },
        ].map(o => (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-2xl text-xs sm:text-sm font-medium text-center',
              'border transition-all duration-150 select-none active:scale-95',
              value === o.value
                ? 'bg-coffee-500 border-coffee-500 text-white shadow-glow-amber'
                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30',
            )}
          >
            <span className="text-base leading-none">{o.icon}</span>
            <span className="leading-tight">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CustomizationPanel({ drink, initial, onBack, onNext }: Props) {
  const [c, setC] = useState<DrinkCustomization>(initial);
  const set = <K extends keyof DrinkCustomization>(key: K, val: DrinkCustomization[K]) =>
    setC(prev => ({ ...prev, [key]: val }));

  const showStrength = drink === 'coffee' || drink === 'tea';
  const showMilk     = drink === 'coffee' || drink === 'tea';

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>


      <h2 className="display text-3xl text-white mb-1">
        Customise your <span className="italic text-coffee-300">
          {drink === 'coffee' ? 'filter coffee' : drink === 'tea' ? 'tea' : 'hot milk'}
        </span>
      </h2>
      <p className="text-white/40 text-sm mb-8">Regular 100ml · make it exactly how you like it</p>


      {showStrength && (
        <OptionRow
          label={drink === 'coffee' ? 'Decoction strength' : 'Brew strength'}
          value={c.strength}
          onChange={v => set('strength', v)}
          options={[
            { value: 'light',  label: 'Light\n20:80',  icon: '🌿' },
            { value: 'medium', label: 'Medium\n30:70', icon: drink === 'coffee' ? '☕' : '🍵' },
            { value: 'strong', label: 'Strong\n40:60', icon: '⚡' },
          ]}
        />
      )}

      {showMilk && <MilkToggle value={c.milk} onChange={v => set('milk', v)} />}

      <button
        onClick={() => onNext(c)}
        className="w-full py-4 rounded-2xl bg-coffee-500 hover:bg-coffee-400 active:scale-[.98]
          text-white font-semibold text-base transition-all duration-150 mt-2 shadow-glow-amber"
      >
        Continue →
      </button>
    </div>
  );
}
