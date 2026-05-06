'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Coffee, Sparkles, XCircle } from 'lucide-react';
import { formatPrice } from '@/lib/utils/cn';

type LiveStatus =
  | 'pending'
  | 'paid'
  | 'dispensing'
  | 'dispensed'
  | 'failed'
  | 'refunded';

/* ───────────────────────── Pipeline mapping ─────────────────────── */

const STEPS = ['Payment', 'Brewing', 'Ready'] as const;

function stepIndexOf(s: LiveStatus): number {
  if (s === 'dispensed')                      return 3; // all done
  if (s === 'dispensing')                     return 2; // pouring
  if (s === 'paid')                           return 1; // brewing
  return 0;
}

/* ────────────────────────────  Magic bits  ──────────────────────── */

/** Slow floating sparkles that drift around the cup. */
function SparkleField() {
  // Stable pseudo-random positions so SSR doesn't flicker on hydrate.
  const dots = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => {
        const a = (i * 137.5) * (Math.PI / 180); // golden-angle scatter
        const r = 90 + ((i * 23) % 40);
        return {
          id:    i,
          x:     Math.cos(a) * r,
          y:     Math.sin(a) * r,
          size:  3 + ((i * 7) % 4),
          delay: (i % 7) * 0.25,
          dur:   3 + ((i * 11) % 4),
        };
      }),
    [],
  );

  return (
    <>
      {dots.map(d => (
        <motion.span
          key={d.id}
          className="absolute rounded-full bg-coffee-300"
          style={{
            width:        d.size,
            height:       d.size,
            top:          '50%',
            left:         '50%',
            x:            d.x,
            y:            d.y,
            filter:       'blur(0.5px)',
            boxShadow:    '0 0 10px rgba(232,181,71,.85)',
          }}
          animate={{
            opacity: [0, 0.9, 0],
            scale:   [0.4, 1.2, 0.4],
          }}
          transition={{
            duration: d.dur,
            delay:    d.delay,
            repeat:   Infinity,
            ease:     'easeInOut',
          }}
        />
      ))}
    </>
  );
}

/** Wavy steam plumes rising out of the cup. */
function Steam({ active }: { active: boolean }) {
  const plumes = [0, 1, 2, 3, 4, 5];
  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ top: -16 }}
    >
      <AnimatePresence>
        {active &&
          plumes.map(i => (
            <motion.span
              key={i}
              className="absolute block rounded-full bg-white/90"
              style={{
                width:  12 + i * 2,
                height: 32 + i * 6,
                left:   (i - 2.5) * 16,
                filter: 'blur(12px)',
                opacity: 0.85 - i * 0.09,
              }}
              initial={{ opacity: 0, y: 0,    scale: 0.7 }}
              animate={{
                opacity: [0, 0.7 - i * 0.08, 0],
                y:       [-4, -96 - i * 8],
                x:       [0, (i % 2 === 0 ? 1 : -1) * (18 + i * 2), 0],
                scale:   [0.8, 1.2 + i * 0.05, 1.5 + i * 0.08],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.8 + i * 0.2,
                delay:    i * 0.22,
                repeat:   Infinity,
                ease:     'easeOut',
              }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

/** A magical cup that fills with liquid as we progress. */
function MagicCup({
  fill,            // 0..1
  drink,
  active,
  done,
  failed,
}: {
  fill:   number;
  drink:  'coffee' | 'tea';
  active: boolean;
  done:   boolean;
  failed: boolean;
}) {
  const liquidColor =
    drink === 'coffee'
      ? 'from-[#5a2f12] via-[#7a3e16] to-[#a6571c]'
      : 'from-[#9a4a16] via-[#c87326] to-[#e9a14a]';

  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      {/* Pulsing aura */}
      <motion.div
        className={`absolute inset-0 rounded-full blur-2xl ${
          failed ? 'bg-red-500/30' : 'bg-coffee-500/30'
        }`}
        animate={{ scale: [1, 1.15, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Rotating outer ring */}
      <motion.div
        className="absolute inset-2 rounded-full border border-coffee-400/30"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(232,181,71,0) 0%, rgba(232,181,71,.55) 45%, rgba(232,181,71,0) 60%)',
        }}
        animate={{ rotate: failed ? 0 : 360 }}
        transition={{
          duration: 6,
          repeat:   Infinity,
          ease:     'linear',
        }}
      />

      {/* Inner glass disc */}
      <div className="absolute inset-6 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm" />

      {/* Sparkle field around the cup */}
      {!failed && <SparkleField />}

      {/* The cup */}
      <motion.div
        className="relative z-10"
        animate={
          failed
            ? { x: [0, -6, 6, -4, 4, 0] }
            : done
              ? { rotateY: [0, 180, 0], scale: [1, 1.08, 1], filter: 'none' }
              : active
                ? { y: [0, -3, 0], rotate: [-1.2, 1.2, -1.2] }
                : { y: 0, rotate: 0 }
        }
        transition={
          failed
            ? { duration: 0.45 }
            : done
              ? { duration: 1.2, ease: 'easeInOut' }
              : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
        }
        style={done ? { perspective: 600 } : {}}
      >
        {/* Cup body */}
        <div className="relative w-20 h-20 rounded-b-[2.2rem] rounded-t-md bg-white/95 shadow-[0_10px_30px_-10px_rgba(0,0,0,.7)] overflow-hidden border border-white/40">
          {/* Liquid */}
          <motion.div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-b ${liquidColor}`}
            initial={{ height: '0%' }}
            animate={{ height: `${Math.round(fill * 100)}%` }}
            transition={{
              // Slow, continuous rise so it feels like real pouring.
              // ~22s to creep all the way to 100% if `fill` jumps.
              duration: failed ? 0.4 : done ? 1.2 : 22,
              ease:     done ? 'easeOut' : 'linear',
            }}
          >
            {/* Wavy liquid surface */}
            <svg
              className="absolute inset-x-0 -top-2 h-3 w-full"
              viewBox="0 0 80 12"
              preserveAspectRatio="none"
              aria-hidden
            >
              <motion.path
                fill="currentColor"
                className={drink === 'coffee' ? 'text-[#a6571c]' : 'text-[#e9a14a]'}
                animate={{
                  d: [
                    'M0 8 Q 20 2 40 8 T 80 8 V12 H0 Z',
                    'M0 8 Q 20 12 40 6 T 80 8 V12 H0 Z',
                    'M0 8 Q 20 4 40 10 T 80 6 V12 H0 Z',
                    'M0 8 Q 20 2 40 8 T 80 8 V12 H0 Z',
                  ],
                }}
                transition={{
                  duration: 2.4,
                  repeat:   Infinity,
                  ease:     'easeInOut',
                }}
              />
            </svg>

            {/* Surface shimmer */}
            <motion.div
              className="absolute inset-x-0 top-0 h-2 bg-white/40 blur-[1.5px]"
              animate={{ opacity: [0.32, 0.75, 0.32] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />

            {/* Magical sparkles inside the mug */}
            {(active || done) && !failed && Array.from({ length: 7 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-amber-200/80 shadow-lg"
                style={{
                  width:  2 + (i % 2),
                  height: 2 + (i % 2),
                  left:   `${18 + i * 10}%`,
                  bottom: 8 + (i % 3) * 8,
                  filter: 'blur(0.5px)',
                }}
                animate={{ y: [0, -12 - i * 2, 0], opacity: [0.7, 1, 0.7], scale: [1, 1.3, 1] }}
                transition={{
                  duration: 1.8 + i * 0.18,
                  delay:    i * 0.22,
                  repeat:   Infinity,
                  ease:     'easeInOut',
                }}
              />
            ))}

            {/* More bubbles rising */}
            {(active || done) && !failed &&
              Array.from({ length: 7 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full bg-white/80"
                  style={{
                    width:  2 + (i % 2),
                    height: 2 + (i % 2),
                    left:   `${12 + i * 12}%`,
                    bottom: 4,
                  }}
                  animate={{ y: [0, -32 - i * 2], opacity: [0.85, 0] }}
                  transition={{
                    duration: 1.2 + i * 0.18,
                    delay:    i * 0.18,
                    repeat:   Infinity,
                    ease:     'easeOut',
                  }}
                />
              ))}
          </motion.div>
        </div>

        {/* Cup handle */}
        <span className="absolute right-[-14px] top-3 w-5 h-10 rounded-r-full border-4 border-white/95" />

        {/* Saucer */}
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-28 h-3 rounded-full bg-white/15 blur-[2px]" />

        {/* Steam */}
        <Steam active={active && !failed} />
      </motion.div>

      {/* Done state — celebratory ring (removed green ring under cup) */}
      {/* No celebratory ring under the cup after completion */}
    </div>
  );
}

/** Confetti burst when the drink is ready. */
function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => {
        const a    = (i / 22) * Math.PI * 2;
        const dist = 110 + ((i * 13) % 70);
        return {
          id:    i,
          x:     Math.cos(a) * dist,
          y:     Math.sin(a) * dist,
          rot:   (i * 47) % 360,
          color:
            i % 3 === 0
              ? '#E8B547'
              : i % 3 === 1
                ? '#F0D58C'
                : '#34d399',
          delay: (i % 6) * 0.04,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {bits.map(b => (
        <motion.span
          key={b.id}
          className="absolute block w-1.5 h-2.5 rounded-sm"
          style={{ background: b.color }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
          animate={{
            x:       b.x,
            y:       b.y,
            opacity: [0, 1, 0],
            rotate:  b.rot,
          }}
          transition={{ duration: 1.4, delay: b.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────── Stepper ─────────────────────────── */

function Stepper({ stage, failed }: { stage: number; failed: boolean }) {
  return (
    <div className="flex items-center justify-center gap-0.5 mb-8">
      {STEPS.map((label, i) => {
        const reached = stage > i;
        const active  = stage === i + 1 && !failed;
        const done    = reached && !failed;

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center w-20">
              <motion.div
                className={`relative w-7 h-7 rounded-full flex items-center justify-center border ${
                  done
                    ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-300'
                    : active
                      ? 'bg-coffee-500/20 border-coffee-400/60 text-coffee-300'
                      : failed
                        ? 'bg-red-500/15 border-red-400/40 text-red-300'
                        : 'bg-white/5 border-white/15 text-white/40'
                }`}
                animate={
                  active
                    ? { boxShadow: ['0 0 0px rgba(232,181,71,0)', '0 0 14px rgba(232,181,71,.65)', '0 0 0px rgba(232,181,71,0)'] }
                    : {}
                }
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                {done
                  ? <Check size={14} strokeWidth={3} />
                  : active
                    ? <Coffee size={13} className="animate-pulse" />
                    : <span className="text-[10px] font-semibold">{i + 1}</span>}
              </motion.div>
              <span
                className={`mt-1.5 text-[10px] font-medium tracking-wider uppercase ${
                  done || active ? 'text-white/70' : 'text-white/30'
                }`}
              >
                {label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div className="relative w-8 h-px bg-white/10 mx-1">
                <motion.div
                  className={`absolute inset-y-0 left-0 ${
                    failed ? 'bg-red-400/60' : 'bg-coffee-400'
                  }`}
                  initial={{ width: '0%' }}
                  animate={{ width: stage > i + 0.5 ? '100%' : '0%' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── Screen ──────────────────────────── */

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
      } catch {/* ignore */}
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId]);

  const stage  = stepIndexOf(status);
  const done   = status === 'dispensed';
  const failed = status === 'failed' || status === 'refunded';

  /* Liquid fill — slow, continuous pour. We deliberately target a
   * high level even at `paid`, with a long linear transition, so the
   * level visibly creeps up the entire time the user is waiting. */
  const fill =
    failed       ? 0.18 :
    done         ? 1    :
    stage === 2  ? 0.95 :   // dispensing — almost full
    stage === 1  ? 0.85 :   // paid / brewing — fill toward the rim
                   0.18;

  const headline =
    failed ? 'Something went wrong'   :
    done   ? 'Your drink is ready!'   :
             status === 'dispensing'
               ? 'Pouring your drink…'
               : 'Brewing in progress';

  const subline =
    failed ? 'The machine could not complete this order. Please contact staff for a refund.' :
    done   ? `Please collect your ${drink === 'coffee' ? '☕ filter coffee' : '🍵 tea'} at the dispensing slot.` :
             `A little Lyra magic is preparing your ${drink === 'coffee' ? 'filter coffee' : 'tea'}.`;

  return (
    <div className="relative flex flex-col items-center text-center pt-6 pb-8 overflow-hidden">
      {/* Ambient gold aurora behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 30%, rgba(232,181,71,.18), transparent 60%), radial-gradient(40% 35% at 50% 80%, rgba(212,162,74,.12), transparent 70%)',
        }}
      />

      {/* Banner pill */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mb-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-[0.22em] uppercase border ${
          failed
            ? 'bg-red-500/10 border-red-400/30 text-red-300'
            : done
              ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
              : 'bg-coffee-500/10 border-coffee-400/30 text-coffee-300'
        }`}
      >
        {failed
          ? 'Order failed'
          : done
            ? <>Ready <Sparkles size={11} /></>
            : <>Lyra Magic <Sparkles size={11} className="animate-pulse" /></>}
      </motion.div>

      {/* Cup stage */}
      <div className="relative">
        <MagicCup
          fill={fill}
          drink={drink}
          active={!failed && !done}
          done={done}
          failed={failed}
        />
        <AnimatePresence>{done && <Confetti key={paymentId} />}</AnimatePresence>
      </div>

      {/* Failed icon overlay */}
      {failed && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="-mt-12 mb-4 w-12 h-12 rounded-full bg-red-500/20 border border-red-400/40 flex items-center justify-center"
        >
          <XCircle size={26} className="text-red-300" />
        </motion.div>
      )}

      {/* Headline + subline */}
      <motion.div
        key={headline}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-4 max-w-sm"
      >
        <h2 className="text-2xl font-bold text-white mb-2">{headline}</h2>
        <p className="text-white/45 text-sm leading-relaxed">{subline}</p>
      </motion.div>

      {/* Stepper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-7"
      >
        <Stepper stage={stage} failed={failed} />
      </motion.div>

      {/* Receipt card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass rounded-2xl p-4 w-full max-w-xs text-left border border-white/10"
      >
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/40">Amount</span>
          <span className="text-white font-semibold">{formatPrice(amountPaise)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/30">Payment ID</span>
          <span className="text-white/55 font-mono">{paymentId.slice(-12)}</span>
        </div>
      </motion.div>
    </div>
  );
}
