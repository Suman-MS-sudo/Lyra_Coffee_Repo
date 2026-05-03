'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CoffeeMachine, DrinkCustomization } from '@/lib/types/database';
import DrinkSelector from './DrinkSelector';
import CustomizationPanel from './CustomizationPanel';
import OrderSummary from './OrderSummary';
import PaymentSuccess from './PaymentSuccess';
import MachineLiveStatus from './MachineLiveStatus';
import { initiateRazorpayPayment } from '@/lib/actions/payment';
import { BrandFooterCompact } from '@/components/branding/BrandFooter';
import { BrandMonogram, BrandWordmark } from '@/components/branding/BrandWordmark';

type Step = 'drink' | 'customize' | 'summary' | 'success';

export interface OrderState {
  drink:         'coffee' | 'tea';
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

  function navigate(to: Step, dir = 1) {
    setDirection(dir);
    setStep(to);
  }

  function handleDrinkSelect(drink: 'coffee' | 'tea') {
    setOrder(prev => ({ ...prev, drink }));
    navigate('customize');
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
          Filter Coffee &amp; Tea
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
                onPay={handlePayment}
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
    </main>
  );
}
