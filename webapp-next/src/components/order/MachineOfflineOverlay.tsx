'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Virtual game dimensions ────────────────────────────────────────
const GW       = 320;   // virtual canvas width
const GH       = 148;   // virtual canvas height
const GROUND   = 108;   // y of ground line
const CHAR_X   = 52;
const CHAR_W   = 26;
const CHAR_H   = 32;
const GRAVITY  = 0.52;
const JUMP_VEL = -11.2;

interface Obs   { id: number; x: number; w: number; h: number; kind: 0 | 1 | 2 }
interface Cloud { id: number; x: number; y: number; w: number; spd: number }

// ── Coffee-cup SVG character ───────────────────────────────────────
function CupChar({ over, airborne, legTick }: { over: boolean; airborne: boolean; legTick: number }) {
  const legA = Math.sin(legTick) > 0;
  return (
    <svg width={CHAR_W} height={CHAR_H + 10} viewBox="0 0 26 42" style={{ overflow: 'visible' }}>
      {/* Steam (only when alive + running) */}
      {!over && !airborne && (
        <>
          <motion.path d="M8 1 Q6 -1 8 -3 Q10 -5 8 -7" stroke="#D4A24A" strokeWidth="1.1"
            fill="none" strokeLinecap="round"
            animate={{ opacity: [0, 0.6, 0], y: [0, -3] }}
            transition={{ duration: 0.85, repeat: Infinity, repeatDelay: 0, delay: 0 }} />
          <motion.path d="M13 0 Q11 -2 13 -4 Q15 -6 13 -8" stroke="#D4A24A" strokeWidth="1.1"
            fill="none" strokeLinecap="round"
            animate={{ opacity: [0, 0.6, 0], y: [0, -3] }}
            transition={{ duration: 0.85, repeat: Infinity, repeatDelay: 0, delay: 0.28 }} />
        </>
      )}
      {/* Legs */}
      {!over ? (
        <>
          <rect x={legA && !airborne ? 5 : 8} y={27} width={4} height={7} rx={1.5} fill="#b87333" />
          <rect x={legA && !airborne ? 14 : 11} y={27} width={4} height={7} rx={1.5} fill="#b87333" />
        </>
      ) : (
        <>
          <rect x={4} y={27} width={4} height={7} rx={1.5} fill="#b87333" style={{ transform: 'rotate(30deg)', transformOrigin: '6px 27px' }} />
          <rect x={16} y={27} width={4} height={7} rx={1.5} fill="#b87333" style={{ transform: 'rotate(-30deg)', transformOrigin: '18px 27px' }} />
        </>
      )}
      {/* Body */}
      <path d="M4 7 L6 27 H20 L22 7 Z" fill="#1e1208" stroke="#D4A24A" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Rim */}
      <rect x={2} y={3} width={22} height={5} rx={2.5} fill="#D4A24A" opacity="0.75" />
      {/* Handle */}
      <path d="M20 12 C29 12 29 22 20 22" stroke="#D4A24A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Liquid surface */}
      <path d="M6 16 L7 26 H19 L20 16 Z" fill="#D4A24A" opacity="0.13" />
      {/* Eyes */}
      {!over ? (
        <>
          <circle cx={9} cy={15} r={2.3} fill="white" />
          <circle cx={17} cy={15} r={2.3} fill="white" />
          <circle cx={9.6} cy={14.5} r={1.3} fill="#0f0a06" />
          <circle cx={17.6} cy={14.5} r={1.3} fill="#0f0a06" />
          <path d="M8.5 20 Q13 22.5 17.5 20" stroke="white" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.65" />
        </>
      ) : (
        <>
          <text x="6" y="18" fontSize="5.5" fill="white" fontWeight="bold" opacity="0.9">×</text>
          <text x="14" y="18" fontSize="5.5" fill="white" fontWeight="bold" opacity="0.9">×</text>
          <path d="M8.5 21.5 Q13 19.5 17.5 21.5" stroke="white" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

// ── Obstacle SVGs ──────────────────────────────────────────────────
function ObstacleSvg({ w, h, kind }: { w: number; h: number; kind: 0 | 1 | 2 }) {
  if (kind === 0) return (            // tall bean stack
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {[0, 1, 2].map(i => {
        const cy = h * (0.18 + i * 0.32);
        return <ellipse key={i} cx={w / 2} cy={cy} rx={w * 0.42} ry={h * 0.15}
          fill={i === 1 ? '#5a3218' : '#6b3d1e'} stroke="#D4A24A" strokeWidth="1.2" />;
      })}
    </svg>
  );
  if (kind === 1) return (            // short double bean
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <ellipse cx={w * 0.32} cy={h * 0.38} rx={w * 0.3} ry={h * 0.32} fill="#6b3d1e" stroke="#D4A24A" strokeWidth="1.2" />
      <ellipse cx={w * 0.32} cy={h * 0.75} rx={w * 0.28} ry={h * 0.22} fill="#4a2a10" stroke="#D4A24A" strokeWidth="1.2" />
      <ellipse cx={w * 0.68} cy={h * 0.45} rx={w * 0.28} ry={h * 0.38} fill="#5a3218" stroke="#D4A24A" strokeWidth="1.2" />
      <ellipse cx={w * 0.68} cy={h * 0.85} rx={w * 0.22} ry={h * 0.14} fill="#3a1e0a" stroke="#D4A24A" strokeWidth="1.2" />
    </svg>
  );
  // kind === 2 — broken wifi sign
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x={w * 0.1} y={h * 0.1} width={w * 0.8} height={h * 0.35} rx={3}
        fill="#1a0808" stroke="#ef4444" strokeWidth="1.5" />
      <line x1={w * 0.18} y1={h * 0.14} x2={w * 0.82} y2={h * 0.42}
        stroke="#ef4444" strokeWidth="1.6" opacity="0.8" />
      <rect x={w * 0.2} y={h * 0.6} width={w * 0.6} height={h * 0.3} rx={2}
        fill="#1a0808" stroke="#ef4444" strokeWidth="1.5" />
    </svg>
  );
}

// ── Main overlay ───────────────────────────────────────────────────
export default function MachineOfflineOverlay({
  machineName,
  lastSeenAt,
}: {
  machineName: string;
  lastSeenAt:  string | null;
}) {
  // Time-ago display
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const timeAgo = (() => {
    if (!lastSeenAt) return null;
    const d = Math.floor((now - new Date(lastSeenAt).getTime()) / 1000);
    if (d < 60)     return `${d}s ago`;
    if (d < 3600)   return `${Math.floor(d / 60)}m ago`;
    if (d < 86_400) return `${Math.floor(d / 3600)}h ago`;
    return null;
  })();

  // ── Game state lives entirely in a ref to avoid thrashing ────────
  const g = useRef({
    started:   false,
    over:      false,
    charY:     0,       // px above ground
    vel:       0,
    obs:       [] as Obs[],
    clouds:    [] as Cloud[],
    score:     0,
    hiScore:   0,
    speed:     5.0,
    gndOff:    0,
    nextObs:   260,
    legTick:   0,
    obsId:     0,
    cloudId:   0,
    overTimer: 0,
  });

  // Minimal React state used only for rendering
  const [, tick]          = useReducer(n => n + 1, 0);
  const [uiScore,  setUs] = useState(0);
  const [uiHi,     setUh] = useState(0);
  const [uiOver,   setUo] = useState(false);
  const [uiFlash,  setUf] = useState(false);
  const [uiStart,  setUst]= useState(false);

  const jump = useCallback(() => {
    const s = g.current;
    if (!s.started) { s.started = true; setUst(true); }
    if (s.over) return;
    if (s.charY <= 1) s.vel = JUMP_VEL;
  }, []);

  // Keyboard listener
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [jump]);

  // ── RAF game loop ─────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let lastT = performance.now();

    const loop = (t: number) => {
      const dt = Math.min((t - lastT) / 16.667, 2.5);
      lastT = t;
      const s = g.current;

      if (s.started && !s.over) {
        // Physics
        s.vel    += GRAVITY * dt;
        s.charY   = Math.max(0, s.charY - s.vel * dt);
        s.score  += s.speed * dt * 0.09;
        s.speed   = Math.min(5.0 + s.score * 0.003, 14);
        s.gndOff  = (s.gndOff + s.speed * dt) % 44;
        s.legTick += 0.2 * dt;

        // Spawn obstacle
        s.nextObs -= s.speed * dt;
        if (s.nextObs <= 0) {
          const kind = Math.random() < 0.45 ? 0 : Math.random() < 0.55 ? 1 : 2;
          const h = kind === 0 ? 42 : kind === 1 ? 34 : 26;
          const w = kind === 0 ? 20 : kind === 1 ? 36 : 34;
          s.obs.push({ id: s.obsId++, x: GW + 8, w, h, kind: kind as 0 | 1 | 2 });
          s.nextObs = 195 + Math.random() * 210;
        }
        s.obs = s.obs.map(o => ({ ...o, x: o.x - s.speed * dt })).filter(o => o.x + o.w > -10);

        // Clouds
        if (s.clouds.length < 5 && Math.random() < 0.007 * dt) {
          s.clouds.push({ id: s.cloudId++, x: GW + 60, y: 6 + Math.random() * 36, w: 40 + Math.random() * 50, spd: 0.55 + Math.random() * 0.65 });
        }
        s.clouds = s.clouds.map(c => ({ ...c, x: c.x - c.spd * dt })).filter(c => c.x > -110);

        // Collision (shrunk hitbox for fairness)
        const cx1 = CHAR_X + 6, cx2 = CHAR_X + CHAR_W - 6;
        const cy2 = GROUND - s.charY - 3;
        for (const o of s.obs) {
          if (cx2 > o.x + 4 && cx1 < o.x + o.w - 4 && cy2 > GROUND - o.h + 4) {
            s.over = true;
            s.overTimer = 0;
            if (s.score > s.hiScore) { s.hiScore = s.score; setUh(Math.floor(s.score)); }
            setUo(true);
            setUf(true);
            setTimeout(() => setUf(false), 280);
            break;
          }
        }
        setUs(Math.floor(s.score));
      } else if (s.over) {
        s.overTimer += dt;
        if (s.overTimer > 140) {
          s.over = false; s.charY = 0; s.vel = 0;
          s.obs = []; s.score = 0; s.speed = 5.0; s.nextObs = 260;
          setUo(false); setUs(0);
        }
      }

      tick();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const s       = g.current;
  const charYPx = Math.round(s.charY);
  const airborne = charYPx > 3;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/88 backdrop-blur-xl" />

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-[22px] overflow-hidden select-none"
        style={{
          background: 'linear-gradient(175deg, #100b05 0%, #090604 100%)',
          border: '1px solid rgba(212,162,74,0.22)',
          boxShadow: '0 0 0 1px rgba(212,162,74,0.06), 0 32px 72px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        initial={{ y: 90, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 70, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        onClick={jump}
      >
        {/* CRT scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-20 rounded-[22px]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)', opacity: 0.7 }}
        />

        {/* Amber top accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-coffee-400/55 to-transparent" />

        {/* ── HUD row ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div>
            <p className="text-[9px] font-bold tracking-[0.3em] text-white/18 uppercase mb-0.5"
              style={{ fontFamily: 'monospace' }}>{machineName}</p>
            <motion.p
              className="text-[13px] font-bold tracking-[0.22em] uppercase"
              style={{ fontFamily: 'monospace', color: '#ef4444' }}
              animate={{ opacity: [1, 0.55, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              ✕ OFFLINE
            </motion.p>
          </div>
          <div className="text-right">
            <p className="text-[9px] tracking-[0.18em] text-white/18 uppercase"
              style={{ fontFamily: 'monospace' }}>
              HI {String(uiHi).padStart(5, '0')}
            </p>
            <p className="text-[16px] font-bold tracking-[0.12em] text-coffee-400 tabular-nums"
              style={{ fontFamily: 'monospace' }}>
              {String(uiScore).padStart(5, '0')}
            </p>
          </div>
        </div>

        {/* ── Game viewport ────────────────────────────────────── */}
        <div
          className="relative mx-3 rounded-xl overflow-hidden"
          style={{ height: GH, background: '#0b0906', border: '1px solid rgba(212,162,74,0.1)' }}
        >
          {/* Twinkling stars */}
          {[...Array(14)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width:  i % 4 === 0 ? 2 : 1,
                height: i % 4 === 0 ? 2 : 1,
                left:   `${5 + i * 6.5}%`,
                top:    `${4 + (i * 17) % 38}%`,
              }}
              animate={{ opacity: [0.15, 0.7, 0.15] }}
              transition={{ duration: 1.4 + i * 0.35, repeat: Infinity, delay: i * 0.28, ease: 'easeInOut' }}
            />
          ))}

          {/* Clouds */}
          {s.clouds.map(c => (
            <svg
              key={c.id}
              style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: 16, opacity: 0.12, pointerEvents: 'none' }}
              viewBox={`0 0 ${c.w} 16`}
            >
              <ellipse cx={c.w * 0.28} cy={12} rx={c.w * 0.24} ry={6}   fill="#D4A24A" />
              <ellipse cx={c.w * 0.52} cy={8}  rx={c.w * 0.28} ry={8}   fill="#D4A24A" />
              <ellipse cx={c.w * 0.76} cy={12} rx={c.w * 0.22} ry={5.5} fill="#D4A24A" />
            </svg>
          ))}

          {/* Ground line */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: GROUND, height: 1.5, background: 'rgba(212,162,74,0.38)' }} />

          {/* Scrolling ground dashes */}
          {[...Array(11)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left:     ((i * 44 - s.gndOff % 44 + GW) % GW) - 10,
                top:      GROUND + 4,
                width:    22,
                height:   1.5,
                borderRadius: 1,
                background: 'rgba(212,162,74,0.13)',
              }}
            />
          ))}

          {/* Obstacles */}
          {s.obs.map(o => (
            <div key={o.id} style={{ position: 'absolute', left: o.x, top: GROUND - o.h }}>
              <ObstacleSvg w={o.w} h={o.h} kind={o.kind} />
            </div>
          ))}

          {/* Character */}
          <div style={{ position: 'absolute', left: CHAR_X, top: GROUND - charYPx - CHAR_H }}>
            <CupChar over={s.over} airborne={airborne} legTick={s.legTick} />
          </div>

          {/* Hit flash */}
          {uiFlash && <div className="absolute inset-0 bg-red-500/18 pointer-events-none" />}

          {/* Start prompt */}
          <AnimatePresence>
            {!uiStart && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                exit={{ opacity: 0 }}
              >
                <motion.p
                  className="text-coffee-400/60 text-[11px] font-bold tracking-[0.28em] uppercase"
                  style={{ fontFamily: 'monospace' }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                >
                  TAP / SPACE TO START
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game-over banner */}
          <AnimatePresence>
            {uiOver && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1"
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              >
                <p className="text-[14px] font-bold tracking-[0.22em] uppercase text-red-400"
                  style={{ fontFamily: 'monospace' }}>GAME OVER</p>
                <p className="text-[10px] tracking-widest text-white/22"
                  style={{ fontFamily: 'monospace' }}>restarting…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Bottom status bar ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4">
          <p className="text-white/22 text-[10px]" style={{ fontFamily: 'monospace' }}>
            {timeAgo ? `last seen ${timeAgo}` : 'connection lost'}
          </p>
          <div className="flex items-center gap-2">
            <span className="flex gap-[3px]">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="block w-[3px] h-[3px] rounded-full bg-coffee-400/40"
                  animate={{ opacity: [0.18, 0.85, 0.18] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                />
              ))}
            </span>
            <span className="text-white/22 text-[10px]" style={{ fontFamily: 'monospace' }}>
              checking…
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
