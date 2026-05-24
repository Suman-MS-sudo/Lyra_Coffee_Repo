'use client';

import type { DrinkCustomization } from '@/lib/types/database';
import { toast } from 'sonner';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

import type { DrinkType } from '@/lib/types/database';

interface InitiatePaymentOptions {
  machine_id:    string;
  drink_type:    DrinkType;
  customization: DrinkCustomization;
  onSuccess:     (orderId: string, paymentId: string, amount: number) => void;
}

/** Dynamically load the Razorpay checkout.js SDK */
async function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window.Razorpay !== 'undefined') { resolve(true); return; }
    const s   = document.createElement('script');
    s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export async function initiateRazorpayPayment(opts: InitiatePaymentOptions): Promise<void> {
  const sdkLoaded = await loadRazorpay();
  if (!sdkLoaded) {
    toast.error('Payment gateway failed to load. Please check your connection.');
    return;
  }

  // 1. Create Razorpay order on the server
  let orderData: { order_id: string; amount: number; key_id: string; internal_order_id: string };
  try {
    const res = await fetch('/api/payment/order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        machine_id:    opts.machine_id,
        drink_type:    opts.drink_type,
        customization: opts.customization,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error ?? 'Failed to create order');
    }
    orderData = await res.json();
  } catch (err: unknown) {
    toast.error((err as Error).message ?? 'Could not create order. Please try again.');
    return;
  }

  // 2. Open Razorpay checkout
  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay({
      key:         orderData.key_id,
      amount:      orderData.amount,
      currency:    'INR',
      name:        'Lyra Enterprises',
      description:
        opts.drink_type === 'coffee' ? 'Filter Coffee — 100ml'
        : opts.drink_type === 'tea' ? 'Tea — 100ml'
        : 'Hot Milk — 100ml',
      order_id:    orderData.order_id,
      prefill:     { method: 'upi', contact: '9999999999', email: 'kiosk@lyra.co.in' },
      readonly:    { contact: true, email: true },
      theme:       { color: '#D4A24A' },

      handler: async function (response: {
        razorpay_payment_id: string;
        razorpay_order_id:   string;
        razorpay_signature:  string;
      }) {
        // 3. Verify payment server-side
        try {
          const verifyRes = await fetch('/api/payment/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              // We need our internal order_id — we embed it in the Razorpay receipt
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          });
          if (!verifyRes.ok) {
            const { error } = await verifyRes.json().catch(() => ({ error: 'Verification failed' }));
            throw new Error(error);
          }
          const { payment_id } = await verifyRes.json();
          // Pass the INTERNAL order UUID (not the Razorpay order id) so
          // the success screen can poll /api/order/[id]/status correctly.
          opts.onSuccess(orderData.internal_order_id, payment_id, orderData.amount);
          resolve();
        } catch (err) {
          toast.error('Payment verification failed. Contact support if charged.');
          reject(err);
        }
      },

      modal: {
        ondismiss: () => {
          toast('Payment cancelled.');
          resolve();
        },
      },
    });

    rzp.open();
  });
}
