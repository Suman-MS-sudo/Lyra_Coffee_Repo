// ================================================================
//  POST /api/payments/verify
//  Verifies Razorpay HMAC signature server-side, then triggers
//  the machine dispense. This is called by the client after the
//  Razorpay checkout modal succeeds.
// ================================================================
import { NextRequest } from 'next/server';
import { verifyPaymentSchema } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  verifyRazorpaySignature,
  isRateLimited,
  getClientIp,
  apiError,
  apiOk,
} from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ── 1. Rate limit ─────────────────────────────────────────────
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return apiError('Too many requests', 429);

  // ── 2. Validate body ──────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON'); }

  const parsed = verifyPaymentSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error');

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = parsed.data;

  // ── 3. Verify HMAC signature (server-side, cannot be faked) ───
  let sigValid: boolean;
  try {
    sigValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  } catch {
    return apiError('Signature verification failed', 400);
  }
  if (!sigValid) return apiError('Invalid payment signature', 400);

  // ── 4. Load order and cross-validate razorpay_order_id ────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, machine_id, drink_type, customization, status, razorpay_order_id')
    .eq('id', order_id)
    .single();

  if (orderErr || !order) return apiError('Order not found', 404);
  if (order.razorpay_order_id !== razorpay_order_id) return apiError('Order mismatch', 400);

  // ── 5. Idempotency: already paid? ─────────────────────────────
  if (order.status === 'paid' || order.status === 'dispensing' || order.status === 'dispensed') {
    return apiOk({ status: order.status, already_processed: true });
  }
  if (order.status !== 'pending') return apiError('Order cannot be verified in current state', 409);

  // ── 6. Update order status to paid ────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'paid' })
    .eq('id', order_id);
  if (updateErr) {
    console.error('[verify] order update failed', updateErr);
    return apiError('Internal error updating order', 500);
  }

  // ── 7. Persist payment record ─────────────────────────────────
  await supabaseAdmin.from('coffee_payments').insert({
    order_id,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    status: 'captured',
  });

  // ── 8. Trigger machine dispense (fire-and-forget with logging) ─
  triggerDispense(order).catch(err =>
    console.error('[verify] dispense trigger error', err)
  );

  return apiOk({ status: 'paid', order_id });
}

// ── Dispense trigger (calls the internal dispense API) ────────────
async function triggerDispense(order: {
  id: string;
  machine_id: string;
  drink_type: string;
  customization: unknown;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const payload = JSON.stringify({
    machine_id: order.machine_id,
    order_id: order.id,
    drink_type: order.drink_type,
    customization: order.customization,
    payment_id: order.id, // internal reference
  });

  const hmac = (await import('crypto')).default
    .createHmac('sha256', process.env.MACHINE_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  const res = await fetch(`${baseUrl}/api/machine/dispense`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-dispense-signature': hmac,
    },
    body: payload,
  });

  if (!res.ok) {
    console.error('[verify] dispense API returned', res.status);
  }
}
