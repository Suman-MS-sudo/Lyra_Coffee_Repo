'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

const DRINKS = [
  {
    id:    'coffee' as const,
    image: '/drinks/filter-coffee.png',
    name:  'Filter Coffee',
    tag:   'Kaapi',
    desc:  'Authentic South Indian filter coffee.',
    glow:  'rgba(140, 106, 31, 0.55)',     // deep bronze gold
    accent:'#E0B13A',
    ring:  'group-hover:ring-coffee-500/50',
    badge: 'from ₹20',
  },
  {
    id:    'tea' as const,
    image: '/drinks/tea.png?v=4',
    name:  'Tea',
    tag:   'Chai',
    desc:  'Freshly brewed hot tea with boiled milk',
    glow:  'rgba(212, 162, 74, 0.45)',     // light champagne gold
    accent:'#F0D58C',
    ring:  'group-hover:ring-coffee-300/50',
    badge: 'from ₹15',
  },
];

export default function DrinkSelector({
  onSelect,
}: {
  onSelect: (drink: 'coffee' | 'tea') => void;
}) {
  return (
    <div className="animate-fade-in">
      {/* Section header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-[0.32em] text-coffee-400 uppercase mb-2">
          Our Menu
        </p>
        <h2 className="display text-3xl sm:text-4xl text-white leading-tight">
          Pick your <span className="italic text-coffee-300">brew</span>
        </h2>
        <p className="text-white/45 text-sm mt-2">
          Freshly prepared filter coffee &amp; tea, made to order.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {DRINKS.map((d, i) => (
          <motion.button
            key={d.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.45, ease: [0.22, 0.68, 0, 1.05] }}
            onClick={() => onSelect(d.id)}
            className={cn(
              'group relative flex flex-col text-left',
              'rounded-[28px] overflow-hidden',
              'surface',
              'ring-1 ring-white/5',
              d.ring,
              'transition-all duration-300',
              'hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]',
              'active:scale-[.98] active:translate-y-0',
              'cursor-pointer select-none',
            )}
          >
            {/* Image stage with radial brand glow */}
            <div
              className="relative h-[210px] overflow-hidden"
              style={{
                background: `radial-gradient(60% 70% at 50% 55%, ${d.glow} 0%, transparent 70%), linear-gradient(to bottom, rgba(255,255,255,.04), rgba(0,0,0,.25))`,
              }}
            >
              {/* Subtle vignette frame */}
              <div className="absolute inset-3 rounded-2xl ring-1 ring-white/5" />

              <Image
                src={d.image}
                alt={d.name}
                width={220}
                height={220}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain max-h-[180px] w-auto drop-shadow-[0_18px_28px_rgba(0,0,0,0.55)] transition-transform duration-500 ease-out group-hover:scale-[1.07] group-hover:-translate-y-[54%]"
                priority
              />

              {/* Price chip */}
              <span className="absolute top-3.5 right-3.5 text-[10px] font-semibold text-white bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-full ring-1 ring-white/10">
                {d.badge}
              </span>

              {/* Bottom fade for legibility */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* Text block */}
            <div className="px-5 py-5 flex flex-col items-start">
              <span
                className="text-[10px] font-semibold tracking-[0.28em] uppercase mb-1"
                style={{ color: d.accent }}
              >
                {d.tag}
              </span>
              <span className="display text-xl text-white leading-snug">{d.name}</span>
              <span className="text-white/45 text-[13px] mt-2 leading-relaxed">{d.desc}</span>

              {/* Footer cue */}
              <div className="mt-4 pt-3 border-t border-white/5 w-full flex items-center justify-between">
                <span className="text-[11px] text-white/35 tracking-wide">Customise &amp; order</span>
                <span
                  className="text-base transition-transform duration-300 group-hover:translate-x-1"
                  style={{ color: d.accent }}
                >
                  →
                </span>
              </div>
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
