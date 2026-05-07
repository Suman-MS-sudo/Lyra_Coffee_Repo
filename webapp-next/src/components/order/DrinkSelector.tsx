'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

const DRINKS = [
  {
    id:    'coffee' as const,
    image: '/drinks/filter-coffee.png',
    name:  'Coffee',
    tag:   'Kaapi',
    desc:  'Authentic South Indian filter coffee.',
    glow:  'rgba(140, 106, 31, 0.6)',
    accent:'#E0B13A',
    badge: 'from ₹20',
  },
  {
    id:    'tea' as const,
    image: '/drinks/tea.png?v=4',
    name:  'Tea',
    tag:   'Chai',
    desc:  'Freshly brewed hot tea with boiled milk',
    glow:  'rgba(212, 162, 74, 0.5)',
    accent:'#F0D58C',
    badge: 'from ₹15',
  },
  {
    id:    'milk' as const,
    image: '/drinks/milk.png',
    name:  'Hot Milk',
    tag:   'Milk',
    desc:  'Pure hot milk, fresh from the machine.',
    glow:  'rgba(240, 230, 210, 0.4)',
    accent:'#F8F8F8',
    badge: 'from ₹15',
  },
];

import type { DrinkType } from '@/lib/types/database';

export default function DrinkSelector({
  onSelect,
}: {
  onSelect: (drink: DrinkType) => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-[0.32em] text-coffee-400 uppercase mb-2">
          Our Menu
        </p>
        <h2 className="display text-3xl sm:text-4xl text-white leading-tight">
          Pick your <span className="italic text-coffee-300">brew</span>
        </h2>
        <p className="text-white/45 text-sm mt-2">
          Freshly prepared filter coffee, tea, and hot milk, made to order.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {DRINKS.map((d, i) => (
          <motion.button
            key={d.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.45, ease: [0.22, 0.68, 0, 1.05] }}
            whileHover={{
              y: -6,
              boxShadow: `0 28px 80px -16px rgba(0,0,0,0.8), 0 0 0 1px ${d.accent}55`,
              transition: { duration: 0.28, ease: 'easeOut' },
            }}
            whileTap={{ scale: 0.97, y: 0, transition: { duration: 0.12 } }}
            onClick={() => onSelect(d.id)}
            className={cn(
              'group relative flex flex-col text-left overflow-hidden cursor-pointer select-none',
              'rounded-[22px] surface',
            )}
          >
            {/* Image zone — glow background bleeds seamlessly into card body */}
            <div
              className="relative h-[160px] overflow-hidden"
              style={{
                background: `radial-gradient(ellipse at 50% 62%, ${d.glow} 0%, transparent 72%)`,
              }}
            >
              <img
                src={d.image}
                alt={d.name}
                className="absolute inset-0 w-full h-full object-cover drop-shadow-2xl
                           transition-transform duration-500 ease-out group-hover:scale-[1.09]"
              />
              {/* Gradient bleed — fades image area into the dark card surface */}
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
            </div>

            {/* Text block */}
            <div className="px-3 pt-2 pb-3 flex flex-col items-center text-center">
              <span
                className="text-[9px] font-semibold tracking-[0.28em] uppercase mb-0.5"
                style={{ color: d.accent }}
              >
                {d.tag}
              </span>
              <span className="display text-[1rem] text-white leading-snug">{d.name}</span>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="ornament-divider mt-10 px-2">
        <span>Brewed Fresh</span>
      </div>
    </div>
  );
}
