'use client';

import { useState } from 'react';
import type { CoffeeMachine, DrinkType, DrinkCustomization, CreateOrderResponse } from '@/types';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

interface Props {
  machine: CoffeeMachine;
  drink: DrinkType;
  customization: DrinkCustomization;
  onBack: () => void;
  onOrderCreated: (data: CreateOrderResponse) => void;
  onSuccess: (orderId: string) => void;
}

const SIZE_LABEL: Record<DrinkCustomization['size'], string> = {
  small: 'Small',
  regular: 'Regular',
  large: 'Large',
};

export function PaymentStep({ machine, drink, customization, onBack, onOrderCreated, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePay = async () => {
    setLoading(true);
    try {
      // 1. Create order server-side
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_id: machine.id, drink_type: drink, customization }),
      });

      if (!orderRes.ok) {
        const { error } = await orderRes.json();
        throw new Error(error ?? 'Failed to create order');
      }

      const orderData: CreateOrderResponse = await orderRes.json();
      onOrderCreated(orderData);

      // 2. Load Razorpay SDK dynamically
      await loadRazorpay();

      // 3. Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: orderData.razorpay_key_id,
          amount: orderData.amount_paise,
          currency: 'INR',
          name: 'Lyra Coffee',
          description: `${drink === 'coffee' ? 'Coffee' : 'Tea'} — ${SIZE_LABEL[customization.size]}`,
          order_id: orderData.razorpay_order_id,
          prefill: {},
          theme: { color: '#c8861a' },
          modal: {
            ondismiss() {
              reject(new Error('Payment cancelled'));
            },
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // 4. Verify signature server-side
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  order_id: orderData.order_id,
                }),
              });

              if (!verifyRes.ok) throw new Error('Payment verification failed');
              onSuccess(orderData.order_id);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg !== 'Payment cancelled') {
        toast({ title: 'Payment failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Price display
  const basePrice = drink === 'coffee' ? 25 : 20;
  const sizeAdder = customization.size === 'large' ? 5 : customization.size === 'small' ? -3 : 0;
  const totalRs = basePrice + sizeAdder;

  return (
    <div className="pt-4">
      <h2 className="text-lg font-semibold mb-1">Review your order</h2>
      <p className="text-[#7a7062] text-sm mb-6">Confirm and pay securely via UPI</p>

      {/* Order summary */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5 mb-4 space-y-3">
        <Row label="Drink"    value={drink === 'coffee' ? 'Coffee ☕' : 'Tea 🍵'} />
        <Row label="Size"     value={SIZE_LABEL[customization.size]} />
        <Row label="Strength" value={cap(customization.strength)} />
        <Row label="Sugar"    value={cap(customization.sugar)} />
        <div className="border-t border-[#2e2e2e] pt-3">
          <Row label="Total" value={`₹${totalRs}.00`} highlight />
        </div>
      </div>

      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 mb-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#6dbf67]/20 flex items-center justify-center shrink-0">
          <span className="text-[#6dbf67] text-sm">🔒</span>
        </div>
        <p className="text-xs text-[#7a7062]">
          Payment processed by <strong className="text-[#f0ece4]">Razorpay</strong>.
          Your drink will be dispensed automatically after payment is confirmed.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-none w-12 py-4 rounded-2xl border border-[#2e2e2e] text-[#7a7062] text-lg active:scale-95 transition-transform disabled:opacity-40"
        >
          ←
        </button>
        <button
          onClick={handlePay}
          disabled={loading}
          className="flex-1 py-4 rounded-2xl bg-[#c8861a] text-[#0a0a0a] font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
          ) : (
            `Pay ₹${totalRs} via UPI`
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#7a7062] text-sm">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-[#c8861a] text-base font-bold' : ''}`}>{value}</span>
    </div>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment SDK'));
    document.head.appendChild(script);
  });
}
