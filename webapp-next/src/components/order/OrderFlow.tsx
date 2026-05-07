'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { CoffeeMachine, DrinkCustomization, DrinkType } from '@/lib/types/database';
import DrinkSelector from './DrinkSelector';
import CustomizationPanel from './CustomizationPanel';
import OrderSummary from './OrderSummary';
import PaymentSuccess from './PaymentSuccess';
import MachineLiveStatus from './MachineLiveStatus';
import { initiateRazorpayPayment } from '@/lib/actions/payment';
import { BrandFooterCompact } from '@/components/branding/BrandFooter';
import { BrandMonogram, BrandWordmark } from '@/components/branding/BrandWordmark';

type Step = 'drink' | 'customize' | 'summary' | 'success';

function CupPlacementModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-[28px] overflow-hidden text-center"
        style={{ background: 'linear-gradient(170deg,#1c1710 0%,#0f0d0a 100%)', border: '1px solid rgba(255,255,255,0.07)' }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 70, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        {/* Top amber accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-coffee-400/70 to-transparent" />

        <div className="px-6 pt-7 pb-6">
          {/* Scene */}
          <div className="relative h-48 mb-3 flex flex-col items-center">

            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(212,162,74,0.13) 0%, transparent 68%)' }} />

            {/* Machine nozzle + drips */}
            <div className="relative flex flex-col items-center" style={{ zIndex: 2 }}>
              <div className="w-12 h-6 rounded-b-xl flex items-end justify-center pb-1"
                style={{ background: 'linear-gradient(to bottom,#2a2218,#1a1510)', border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none' }}>
                <div className="w-2 h-2 rounded-full bg-coffee-400/40" />
              </div>
              {/* Three animated drips */}
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="absolute" style={{ top: 24 }}>
                  <motion.div
                    className="w-1.5 rounded-full"
                    style={{ background: '#D4A24A', boxShadow: '0 0 6px rgba(212,162,74,0.9)' }}
                    animate={{ y: [0, 72], height: [4, 10, 4], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4, ease: 'easeIn' }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Cup character */}
            <motion.div
              className="absolute bottom-0"
              initial={{ scale: 0, rotate: -25, y: 30 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              transition={{ type: 'spring', stiffness: 480, damping: 18, delay: 0.1 }}
            >
              <motion.div
                animate={{ y: [0, -9, 0], rotate: [-5, 5, -5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="cpBodyGrad" x1="16" y1="24" x2="72" y2="72" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#2e2418" />
                      <stop offset="100%" stopColor="#181210" />
                    </linearGradient>
                  </defs>
                  {/* Body */}
                  <path d="M16 24 L22 70 H66 L72 24 Z" fill="url(#cpBodyGrad)" />
                  <path d="M16 24 L22 70 H66 L72 24 Z" fill="none" stroke="#D4A24A" strokeWidth="2" strokeLinejoin="round" />
                  {/* Rim */}
                  <rect x="12" y="19" width="64" height="8" rx="4" fill="#D4A24A" opacity="0.65" />
                  {/* Handle */}
                  <path d="M68 36 C86 36 86 60 68 60" stroke="#D4A24A" strokeWidth="3" fill="none" strokeLinecap="round" />
                  {/* Liquid */}
                  <path d="M23 46 L26 67 H62 L65 46 Z" fill="#D4A24A" opacity="0.2" />
                  {/* Left eye white */}
                  <circle cx="33" cy="42" r="5" fill="white" />
                  {/* Right eye white */}
                  <circle cx="55" cy="42" r="5" fill="white" />
                  {/* Left pupil — looks up */}
                  <motion.circle cx="33" cy="42" r="2.8" fill="#1a1208"
                    animate={{ cy: [42, 39, 42, 42, 42] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} />
                  {/* Right pupil — looks up */}
                  <motion.circle cx="55" cy="42" r="2.8" fill="#1a1208"
                    animate={{ cy: [42, 39, 42, 42, 42] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }} />
                  {/* Blink — left eyelid */}
                  <motion.rect x="28" y="37" width="10" height="10" rx="5" fill="white"
                    animate={{ scaleY: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0] }}
                    style={{ transformOrigin: '33px 42px' }}
                    transition={{ duration: 3.5, repeat: Infinity, delay: 1.2 }} />
                  {/* Blink — right eyelid */}
                  <motion.rect x="50" y="37" width="10" height="10" rx="5" fill="white"
                    animate={{ scaleY: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0] }}
                    style={{ transformOrigin: '55px 42px' }}
                    transition={{ duration: 3.5, repeat: Infinity, delay: 1.2 }} />
                  {/* Smile */}
                  <path d="M34 56 Q44 63 54 56" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.75" />
                </svg>
              </motion.div>
            </motion.div>

            {/* Speech bubble */}
            <motion.div
              className="absolute right-0 bottom-16 px-3 py-1.5 rounded-2xl rounded-br-sm text-xs font-semibold text-white/90"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              initial={{ scale: 0, opacity: 0, x: 10 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 400, damping: 22 }}
            >
              Pick me! 🙋
            </motion.div>
          </div>

          <h3 className="display text-2xl text-white mb-2">Hold up! ✋</h3>
          <p className="text-white/45 text-sm leading-relaxed mb-6">
            The machine is ready to pour — but your cup isn&apos;t in position yet.
            Slide it under the nozzle first!
          </p>

          <motion.button
            onClick={onConfirm}
            className="w-full py-4 rounded-2xl bg-coffee-500 hover:bg-coffee-400 active:scale-[.98]
              text-white font-semibold text-base transition-all shadow-glow-amber
              flex items-center justify-center gap-2 mb-3"
            whileTap={{ scale: 0.97 }}
          >
            <Sparkles size={16} />
            Cup&apos;s in — pour it!
          </motion.button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-white/25 hover:text-white/55 text-sm transition-colors"
          >
            One sec...
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export interface OrderState {
  drink:         DrinkType;
  customization: DrinkCustomization;
  orderId:       string;
  amountPaise:   number;
  paymentId:     string;
}

const slideVariants = {
  enter:  (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

const DEFAULT_CUSTOMIZATION: DrinkCustomization = {
  sugar:    'none',
  strength: 'medium',
  milk:     true,
};

export default function OrderFlow({
  machine,
}: {
  machine: Pick<CoffeeMachine, 'id' | 'name' | 'location' | 'is_free' | 'price_coffee_paise' | 'price_tea_paise'> & {
    last_seen_at?: string | null;
  };
}) {
  const [step,       setStep]       = useState<Step>('drink');
  const [direction,  setDirection]  = useState(1);
  const [order,      setOrder]      = useState<Partial<OrderState>>({
    customization: DEFAULT_CUSTOMIZATION,
  });
  const [loading,    setLoading]    = useState(false);
  const [showCupModal, setShowCupModal] = useState(false);

  function navigate(to: Step, dir = 1) {
    setDirection(dir);
    setStep(to);
  }

  function handleDrinkSelect(drink: DrinkType) {
    setOrder(prev => ({ ...prev, drink }));
    if (drink === 'milk') {
      // For milk, skip customization and go straight to summary
      navigate('summary');
    } else {
      navigate('customize');
    }
  }

  function handleCustomization(c: DrinkCustomization) {
    setOrder(prev => ({ ...prev, customization: c }));
    navigate('summary');
  }

  async function handlePayment() {
    if (!order.drink || !order.customization) return;
    setLoading(true);
    try {
      if (machine.is_free) {
        // Free machine — skip Razorpay, place order directly.
        const res = await fetch('/api/payment/free-order', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machine_id:    machine.id,
            drink_type:    order.drink,
            customization: order.customization,
          }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Failed to place order' }));
          const { toast } = await import('sonner');
          toast.error(error ?? 'Failed to place order');
          return;
        }
        const { order_id } = await res.json();
        setOrder(prev => ({ ...prev, orderId: order_id, paymentId: order_id, amountPaise: 0 }));
        navigate('success');
        return;
      }

      await initiateRazorpayPayment({
        machine_id:    machine.id,
        drink_type:    order.drink,
        customization: order.customization,
        onSuccess: (orderId, paymentId, amount) => {
          setOrder(prev => ({ ...prev, orderId, paymentId, amountPaise: amount }));
          navigate('success');
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const STEPS: Step[] = ['drink', 'customize', 'summary', 'success'];
  const stepIdx = STEPS.indexOf(step);

  return (
    <main className="min-h-dvh flex flex-col max-w-md mx-auto">
      {/* ── Brand bar ────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between border-b border-white/5">
        <BrandWordmark size="sm" withLogo />
        <span className="text-[10px] font-semibold tracking-[0.2em] text-lyra-pink uppercase">
          Filter Coffee, Tea &amp; Milk
        </span>
      </div>

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.28em] mb-1.5">
            {machine.location ?? 'Lyra Enterprises'}
          </p>
          <h1 className="display text-2xl text-white leading-tight">{machine.name}</h1>          <div className="mt-2">
            <MachineLiveStatus
              machineId={machine.id}
              initialLastSeenAt={machine.last_seen_at ?? null}
            />
          </div>        </div>
        <BrandMonogram size={44} />
      </header>

      {/* ── Progress bar ──────────────────────────────────────── */}
      {step !== 'success' && (
        <div className="px-5 mb-6">
          <div className="flex gap-1.5">
            {(['drink', 'customize', 'summary'] as Step[]).map((s, i) => (
              <div
                key={s}
                className="h-1 flex-1 rounded-full overflow-hidden bg-white/10"
              >
                <motion.div
                  className="h-full bg-coffee-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: stepIdx > i ? '100%' : stepIdx === i ? '60%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step content ─────────────────────────────────────── */}
      <div className="flex-1 px-5 pb-8 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 0.68, 0, 1] }}
          >
            {step === 'drink' && (
              <DrinkSelector onSelect={handleDrinkSelect} />
            )}
            {step === 'customize' && order.drink && (
              <CustomizationPanel
                drink={order.drink}
                initial={order.customization ?? DEFAULT_CUSTOMIZATION}
                onBack={() => navigate('drink', -1)}
                onNext={handleCustomization}
              />
            )}
            {step === 'summary' && order.drink && order.customization && (
              <OrderSummary
                machineId={machine.id}
                drink={order.drink}
                customization={order.customization}
                isFree={machine.is_free}
                priceCoffeePaise={machine.price_coffee_paise}
                priceTeaPaise={machine.price_tea_paise}
                onBack={() => navigate('customize', -1)}
                onPay={() => setShowCupModal(true)}
                loading={loading}
              />
            )}
            {step === 'success' && order.paymentId && (
              <PaymentSuccess
                drink={order.drink ?? 'coffee'}
                paymentId={order.paymentId}
                amountPaise={order.amountPaise ?? 0}
                orderId={order.orderId}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BrandFooterCompact />

      <AnimatePresence>
        {showCupModal && (
          <CupPlacementModal
            onConfirm={() => { setShowCupModal(false); handlePayment(); }}
            onCancel={() => setShowCupModal(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
