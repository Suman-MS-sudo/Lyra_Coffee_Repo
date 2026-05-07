'use client';

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Coffee, Sparkles, XCircle } from 'lucide-react';
import { CupChar, ObstacleSvg } from './MachineOfflineOverlay';

import type { DrinkType } from '@/lib/types/database';

type LiveStatus =
  | 'pending'
  | 'paid'
  | 'dispensing'
  | 'dispensed'
  | 'failed'
  | 'refunded';

/* ───────────────────────── Pipeline mapping ─────────────────────── */

const STEPS = ['Processing', 'Brewing', 'Ready'] as const;

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
  drink:  DrinkType;
  active: boolean;
  done:   boolean;
  failed: boolean;
}) {
  let liquidColor = '';
  if (drink === 'coffee') {
    liquidColor = 'from-[#5a2f12] via-[#7a3e16] to-[#a6571c]';
  } else if (drink === 'tea') {
    liquidColor = 'from-[#9a4a16] via-[#c87326] to-[#e9a14a]';
  } else {
    liquidColor = 'from-[#b8864a] via-[#d4a96a] to-[#eedbb0]'; // milk: warm golden-cream, visible against white cup
  }

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
        style={{ transformPerspective: 700 }}
        animate={
          failed
            ? { x: [0, -6, 6, -4, 4, 0] }
            : done
              ? {
                  scale:  [1, 1.06, 1.03],
                  filter: [
                    'drop-shadow(0 0 0px rgba(232,181,71,0))',
                    'drop-shadow(0 0 28px rgba(232,181,71,0.9))',
                    'drop-shadow(0 0 12px rgba(232,181,71,0.4))',
                  ],
                }
              : active
                ? { y: [0, -3, 0], rotate: [-1.2, 1.2, -1.2] }
                : { y: 0, rotate: 0 }
        }
        transition={
          failed
            ? { duration: 0.45 }
            : done
              ? { duration: 0.9, ease: 'easeOut' }
              : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
        }
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
                className={drink === 'coffee' ? 'text-[#a6571c]' : drink === 'tea' ? 'text-[#e9a14a]' : 'text-[#d4a96a]'}
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
    </div>
  );
}

/** Magical golden sparkle burst when the drink is ready. */
function MagicBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * Math.PI * 2;
        const dist  = 72 + ((i * 19) % 64);
        const size  = 2.5 + ((i * 7) % 6);
        return {
          id:    i,
          x:     Math.cos(angle) * dist,
          y:     Math.sin(angle) * dist,
          size,
          delay: (i % 10) * 0.045,
          color:
            i % 4 === 0 ? '#E8B547'
            : i % 4 === 1 ? '#F0D58C'
            : i % 4 === 2 ? '#fffbe0'
            : '#D4A24A',
          glow:  `0 0 ${8 + size * 2}px rgba(232,181,71,0.95)`,
          dur:   1.4 + ((i * 11) % 6) * 0.08,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map(p => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, background: p.color, boxShadow: p.glow }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x:       [0, p.x * 0.55, p.x],
            y:       [0, p.y * 0.55, p.y],
            opacity: [0, 1, 0.9, 0],
            scale:   [0, 2.2, 1.4, 0],
          }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }}
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

/* ──────────── Auto-playing cup runner (popup bottom strip) ──────── */
/*
 * Same physics as the offline dino game but the cup jumps itself:
 * when an obstacle enters the "reaction window" (proportional to speed)
 * the AI fires a jump. No user input needed.
 */

const RUN_GW     = 320;
const RUN_GH     = 88;
const RUN_GROUND = 62;
const RUN_CX     = 52;
const RUN_CW     = 26;
const RUN_CH     = 32;
const RUN_GRAV   = 0.52;
const RUN_JUMP   = -8.5;   // softer than the full game so cup stays in frame

interface RunObs { id: number; x: number; w: number; h: number; kind: 0 | 1 }

function AutoCupGame() {
  const g = useRef({
    charY:     0,
    vel:       0,
    obs:       [] as RunObs[],
    score:     0,
    speed:     4.8,
    gndOff:    0,
    nextObs:   220,
    legTick:   0,
    obsId:     0,
    over:      false,
    overTimer: 0,
  });

  const [, tick]      = useReducer((n: number) => n + 1, 0);
  const [uiScore, setUs] = useState(0);
  const [uiOver,  setUo] = useState(false);

  useEffect(() => {
    let raf: number;
    let lastT = performance.now();

    const loop = (t: number) => {
      const dt = Math.min((t - lastT) / 16.667, 2.5);
      lastT = t;
      const s = g.current;

      if (!s.over) {
        s.vel     += RUN_GRAV * dt;
        s.charY    = Math.max(0, s.charY - s.vel * dt);
        s.score   += s.speed * dt * 0.09;
        s.speed    = Math.min(4.8 + s.score * 0.003, 11);
        s.gndOff   = (s.gndOff + s.speed * dt) % 44;
        s.legTick += 0.2 * dt;

        // AI: jump when the nearest threat enters the reaction window
        if (s.charY <= 1) {
          const window = s.speed * 17 + 30;
          const threat = s.obs.find(o => o.x + o.w > RUN_CX && o.x - RUN_CX < window);
          if (threat) s.vel = RUN_JUMP;
        }

        // Spawn obstacle
        s.nextObs -= s.speed * dt;
        if (s.nextObs <= 0) {
          const kind = Math.random() < 0.5 ? 0 : 1;
          s.obs.push({
            id:   s.obsId++,
            x:    RUN_GW + 8,
            w:    kind === 0 ? 18 : 32,
            h:    kind === 0 ? 28 : 22,
            kind: kind as 0 | 1,
          });
          s.nextObs = 210 + Math.random() * 190;
        }
        s.obs = s.obs
          .map(o => ({ ...o, x: o.x - s.speed * dt }))
          .filter(o => o.x + o.w > -10);

        // Collision (shrunk hitbox)
        const cx1 = RUN_CX + 6, cx2 = RUN_CX + RUN_CW - 6;
        const cy2 = RUN_GROUND - s.charY - 3;
        for (const o of s.obs) {
          if (cx2 > o.x + 4 && cx1 < o.x + o.w - 4 && cy2 > RUN_GROUND - o.h + 4) {
            s.over = true; s.overTimer = 0;
            setUo(true);
            break;
          }
        }
        setUs(Math.floor(s.score));
      } else {
        s.overTimer += dt;
        if (s.overTimer > 55) {
          // Auto-restart
          Object.assign(s, { over: false, charY: 0, vel: 0, obs: [], score: 0, speed: 4.8, nextObs: 220 });
          setUo(false); setUs(0);
        }
      }

      tick();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s        = g.current;
  const charYPx  = Math.round(s.charY);
  const airborne = charYPx > 3;

  return (
    <div
      className="relative overflow-hidden select-none pointer-events-none"
      style={{ height: RUN_GH, background: '#0b0906', borderTop: '1px solid rgba(212,162,74,0.10)' }}
    >
      {/* CRT scanlines */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)' }}
      />

      {/* Stars */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ width: i % 3 === 0 ? 2 : 1, height: i % 3 === 0 ? 2 : 1, left: `${4 + i * 9.5}%`, top: `${5 + (i * 13) % 26}%` }}
          animate={{ opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: 1.5 + i * 0.3, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
        />
      ))}

      {/* Ground line */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: RUN_GROUND, height: 1.5, background: 'rgba(212,162,74,0.32)' }} />

      {/* Scrolling ground dashes */}
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left:   ((i * 44 - s.gndOff % 44 + RUN_GW) % RUN_GW) - 10,
            top:    RUN_GROUND + 4,
            width:  22, height: 1.5, borderRadius: 1,
            background: 'rgba(212,162,74,0.11)',
          }}
        />
      ))}

      {/* Obstacles */}
      {s.obs.map(o => (
        <div key={o.id} style={{ position: 'absolute', left: o.x, top: RUN_GROUND - o.h }}>
          <ObstacleSvg w={o.w} h={o.h} kind={o.kind} />
        </div>
      ))}

      {/* Cup character */}
      <div style={{ position: 'absolute', left: RUN_CX, top: RUN_GROUND - charYPx - RUN_CH }}>
        <CupChar over={s.over} airborne={airborne} legTick={s.legTick} />
      </div>

      {/* Score */}
      <div
        className="absolute top-2 right-3 z-20 text-coffee-400/55 tabular-nums"
        style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: '0.14em' }}
      >
        {String(uiScore).padStart(5, '0')}
      </div>

      {/* Crash flash */}
      {uiOver && <div className="absolute inset-0 bg-red-500/14 pointer-events-none z-10" />}
    </div>
  );
}

/* ─────────────────────── Brew Complete Popup ───────────────────── */

function BrewCompletePopup({
  drink,
  onBrewMore,
  onClose,
}: {
  drink:      DrinkType;
  onBrewMore: () => void;
  onClose:    () => void;
}) {
  const icon = drink === 'coffee' ? '☕' : drink === 'tea' ? '🍵' : '🥛';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Blurred backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-xs"
        initial={{ scale: 0.45, opacity: 0, y: 32 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.85, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 480, damping: 24 }}
      >
        {/* Pulsing amber glow behind the card */}
        <motion.div
          className="absolute -inset-3 rounded-[36px] pointer-events-none"
          style={{ background: 'rgba(212,162,74,0.28)', filter: 'blur(18px)' }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.97, 1.03, 0.97] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Static amber border */}
        <div
          className="absolute -inset-[1.5px] rounded-[28px] pointer-events-none"
          style={{ background: 'linear-gradient(140deg, #E8B547, #9a6010, #E8B547)' }}
        />

        {/* Inner card */}
        <div
          className="relative rounded-[27px] overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #1d1710 0%, #0e0c09 100%)' }}
        >
          {/* Subtle amber grid — gaming HUD texture */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(232,181,71,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(232,181,71,0.045) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          {/* HUD corner brackets */}
          {[
            ['top-3 left-3',    'top-0 left-0',    'top-0 left-0'   ],
            ['top-3 right-3',   'top-0 right-0',   'top-0 right-0'  ],
            ['bottom-3 right-3','bottom-0 right-0','bottom-0 right-0'],
            ['bottom-3 left-3', 'bottom-0 left-0', 'bottom-0 left-0'],
          ].map(([wrap, h, v], i) => (
            <div key={i} className={`absolute ${wrap} w-4 h-4 pointer-events-none`}>
              <div className={`absolute ${h} w-full h-[1.5px] bg-coffee-400/55`} />
              <div className={`absolute ${v} w-[1.5px] h-full bg-coffee-400/55`} />
            </div>
          ))}

          <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">

            {/* Achievement badge */}
            <motion.div
              initial={{ opacity: 0, y: -14, scale: 0.75 }}
              animate={{ opacity: 1, y: 0,   scale: 1    }}
              transition={{ delay: 0.08, type: 'spring', stiffness: 380, damping: 22 }}
              className="mb-5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full
                border border-coffee-400/50 bg-coffee-500/10"
            >
              <Sparkles size={9} className="text-coffee-300" />
              <span className="text-[9px] font-bold tracking-[0.32em] uppercase text-coffee-300">
                Achievement Unlocked
              </span>
              <Sparkles size={9} className="text-coffee-300" />
            </motion.div>

            {/* Drink emoji */}
            <motion.div
              className="text-6xl mb-3 select-none"
              style={{ filter: 'drop-shadow(0 0 18px rgba(232,181,71,0.75))' }}
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0  }}
              transition={{ delay: 0.18, type: 'spring', stiffness: 440, damping: 16 }}
            >
              {icon}
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-[1.65rem] font-black uppercase tracking-widest text-white leading-none"
              style={{ textShadow: '0 0 22px rgba(232,181,71,0.55)' }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1  }}
              transition={{ delay: 0.28, type: 'spring', stiffness: 340, damping: 20 }}
            >
              Brew Complete!
            </motion.h2>

            {/* Star rating */}
            <div className="flex gap-1.5 my-4">
              {[0, 1, 2, 3, 4].map(i => (
                <motion.span
                  key={i}
                  className="text-xl select-none"
                  initial={{ scale: 0, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.44 + i * 0.09,
                    type: 'spring',
                    stiffness: 600,
                    damping: 14,
                  }}
                >
                  ⭐
                </motion.span>
              ))}
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-coffee-400/30 to-transparent mb-4" />

            {/* Collect hint */}
            <motion.p
              className="text-white/38 text-xs tracking-wide mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.92 }}
            >
              Collect your {drink} at the dispensing slot
            </motion.p>

            {/* Brew More CTA */}
            <motion.button
              onClick={onBrewMore}
              whileTap={{ scale: 0.95 }}
              className="relative w-full py-4 rounded-2xl overflow-hidden
                font-black text-sm uppercase tracking-[0.22em] text-white
                flex items-center justify-center gap-2.5 mb-3"
              style={{
                background: 'linear-gradient(130deg, #b8700e 0%, #e8a828 45%, #b8700e 100%)',
                boxShadow: '0 0 28px rgba(232,181,71,0.42), 0 4px 20px rgba(0,0,0,0.45)',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0  }}
              transition={{ delay: 1.0, type: 'spring', stiffness: 380, damping: 22 }}
            >
              {/* Shimmer sweep */}
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/22 to-transparent -skew-x-12"
                animate={{ x: ['-130%', '230%'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 }}
              />
              <Coffee size={17} />
              Brew More
            </motion.button>

            {/* Dismiss */}
            <motion.button
              onClick={onClose}
              className="text-white/25 hover:text-white/50 text-xs transition-colors py-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.25 }}
            >
              I&apos;m good, thanks
            </motion.button>
          </div>

          {/* Auto-playing cup runner */}
          <AutoCupGame />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────────────────── Screen ──────────────────────────── */

export default function PaymentSuccess({
  drink,
  paymentId,
  orderId,
  onOrderMore,
}: {
  drink:        DrinkType;
  paymentId:    string;
  orderId?:     string;
  onOrderMore?: () => void;
}) {
  const [status,     setStatus]     = useState<LiveStatus>('paid');
  const [showRepeat, setShowRepeat] = useState(false);

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

  /* Show "Brew more" button 1.2 s after drink is dispensed */
  useEffect(() => {
    if (!done) { setShowRepeat(false); return; }
    const t = setTimeout(() => setShowRepeat(true), 1200);
    return () => clearTimeout(t);
  }, [done]);

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
    done   ? `Please collect your ${drink === 'coffee' ? '☕ filter coffee' : drink === 'tea' ? '🍵 tea' : '🥛 hot milk'} at the dispensing slot.` :
             `A little Lyra magic is preparing your ${drink === 'coffee' ? 'filter coffee' : drink === 'tea' ? 'tea' : 'hot milk'}.`;

  return (
    <div className="relative flex flex-col items-center text-center pt-6 pb-8 overflow-hidden">
      {/* Ambient gold aurora — fixed so it covers the full viewport including the header */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 30%, rgba(232,181,71,.22), transparent 60%), radial-gradient(40% 35% at 50% 80%, rgba(212,162,74,.14), transparent 70%)',
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
        <AnimatePresence>{done && <MagicBurst key={paymentId} />}</AnimatePresence>
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

      {/* Brew Complete popup */}
      <AnimatePresence>
        {showRepeat && onOrderMore && (
          <BrewCompletePopup
            drink={drink}
            onBrewMore={onOrderMore}
            onClose={() => setShowRepeat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
