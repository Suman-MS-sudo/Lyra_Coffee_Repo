'use client';

import type { DrinkType, DrinkCustomization } from '@/types';

interface Props {
  drink: DrinkType;
  customization: DrinkCustomization;
  onChange: (c: DrinkCustomization) => void;
  onBack: () => void;
  onNext: () => void;
}

type OptionGroup<K extends keyof DrinkCustomization> = {
  key: K;
  label: string;
  options: { value: DrinkCustomization[K]; label: string }[];
};

const groups: OptionGroup<keyof DrinkCustomization>[] = [
  {
    key: 'size',
    label: 'Size',
    options: [
      { value: 'small',   label: 'S  · Small'   },
      { value: 'regular', label: 'M  · Regular'  },
      { value: 'large',   label: 'L  · Large +₹5'},
    ],
  },
  {
    key: 'strength',
    label: 'Strength',
    options: [
      { value: 'mild',    label: 'Mild'    },
      { value: 'regular', label: 'Regular' },
      { value: 'strong',  label: 'Strong'  },
    ],
  },
  {
    key: 'sugar',
    label: 'Sugar',
    options: [
      { value: 'none',    label: 'No sugar' },
      { value: 'less',    label: 'Less'     },
      { value: 'regular', label: 'Regular'  },
      { value: 'extra',   label: 'Extra'    },
    ],
  },
];

export function CustomizePanel({ drink, customization, onChange, onBack, onNext }: Props) {
  return (
    <div className="pt-4">
      <h2 className="text-lg font-semibold mb-1">
        Customise your {drink === 'coffee' ? 'coffee' : 'tea'}
      </h2>
      <p className="text-[#7a7062] text-sm mb-6">Make it exactly how you like it</p>

      <div className="space-y-6 mb-8">
        {groups.map(group => (
          <div key={group.key}>
            <p className="text-xs uppercase tracking-widest text-[#7a7062] mb-2">{group.label}</p>
            <div className={`grid gap-2 ${group.options.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {group.options.map(opt => {
                const active = customization[group.key] === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => onChange({ ...customization, [group.key]: opt.value })}
                    className={`py-3 px-2 rounded-xl border text-xs font-medium text-center transition-all duration-150 active:scale-95
                      ${active
                        ? 'border-[#c8861a] bg-[#c8861a]/10 text-[#c8861a]'
                        : 'border-[#2e2e2e] bg-[#1a1a1a] text-[#f0ece4] hover:border-[#3e3e3e]'
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-none w-12 py-4 rounded-2xl border border-[#2e2e2e] text-[#7a7062] text-lg active:scale-95 transition-transform"
        >
          ←
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-4 rounded-2xl bg-[#c8861a] text-[#0a0a0a] font-semibold text-base active:scale-[0.98] transition-transform"
        >
          Review &amp; Pay →
        </button>
      </div>
    </div>
  );
}
