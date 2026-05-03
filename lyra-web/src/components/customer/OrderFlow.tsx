'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CoffeeMachine, DrinkType, DrinkCustomization, CreateOrderResponse } from '@/types';
import { DrinkSelector } from './DrinkSelector';
import { CustomizePanel } from './CustomizePanel';
import { PaymentStep } from './PaymentStep';
import { SuccessScreen } from './SuccessScreen';
import { MachineUnavailable } from './MachineUnavailable';

// ── Step definitions ───────────────────────────────────────────────
type Step = 'drink' | 'customize' | 'payment' | 'success' | 'unavailable';

function OrderFlowInner() {
  const searchParams = useSearchParams();
  const machineId = searchParams.get('machine');

  const [machine, setMachine] = useState<CoffeeMachine | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('drink');

  const [drink, setDrink] = useState<DrinkType>('coffee');
  const [customization, setCustomization] = useState<DrinkCustomization>({
    sugar: 'regular',
    strength: 'regular',
    size: 'regular',
  });
  const [orderData, setOrderData] = useState<CreateOrderResponse | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string>('');

  // ── Load machine ─────────────────────────────────────────────
  useEffect(() => {
    if (!machineId) { setLoading(false); setStep('unavailable'); return; }

    fetch(`/api/machines/${machineId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: CoffeeMachine | null) => {
        if (!data || data.status !== 'active') {
          setStep('unavailable');
        } else {
          setMachine(data);
        }
      })
      .catch(() => setStep('unavailable'))
      .finally(() => setLoading(false));
  }, [machineId]);

  if (loading) return <LoadingScreen />;
  if (step === 'unavailable') return <MachineUnavailable />;

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-md px-5 pt-8 pb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-[#c8861a]">Lyra</span> Coffee
        </h1>
        {machine && (
          <p className="text-xs text-[#7a7062] mt-1 uppercase tracking-widest">
            {machine.name}{machine.location ? ` · ${machine.location}` : ''}
          </p>
        )}
        {/* Step indicator */}
        <StepIndicator step={step} />
      </header>

      {/* Step content */}
      <main className="w-full max-w-md px-4 flex-1">
        <AnimatePresence mode="wait">
          {step === 'drink' && (
            <motion.div key="drink" {...slideIn}>
              <DrinkSelector
                selected={drink}
                onSelect={setDrink}
                onNext={() => setStep('customize')}
              />
            </motion.div>
          )}

          {step === 'customize' && (
            <motion.div key="customize" {...slideIn}>
              <CustomizePanel
                drink={drink}
                customization={customization}
                onChange={setCustomization}
                onBack={() => setStep('drink')}
                onNext={() => setStep('payment')}
              />
            </motion.div>
          )}

          {step === 'payment' && machine && (
            <motion.div key="payment" {...slideIn}>
              <PaymentStep
                machine={machine}
                drink={drink}
                customization={customization}
                onBack={() => setStep('customize')}
                onOrderCreated={setOrderData}
                onSuccess={(orderId) => {
                  setSuccessOrderId(orderId);
                  setStep('success');
                }}
              />
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" {...slideIn}>
              <SuccessScreen
                drink={drink}
                customization={customization}
                orderId={successOrderId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

const slideIn = {
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: 'easeOut' as const },
};

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ['drink', 'customize', 'payment'];
  const idx = steps.indexOf(step);
  if (idx === -1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`h-1 rounded-full transition-all duration-300 ${
            i <= idx ? 'w-8 bg-[#c8861a]' : 'w-4 bg-[#2e2e2e]'
          }`}
        />
      ))}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-[#c8861a] border-t-transparent animate-spin" />
    </div>
  );
}

// Wrap in Suspense because useSearchParams requires it
export default function OrderFlow() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <OrderFlowInner />
    </Suspense>
  );
}
