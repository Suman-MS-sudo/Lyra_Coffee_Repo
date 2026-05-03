import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyPaymentSchema } from '@/lib/validators/schemas';
import {
  verifyRazorpayPaymentSignature,
  checkRateLimit,
  getClientIp,
  apiError,
} from '@/lib/utils/security';

export async function POST(req: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`verify:${ip}`, 10)) {
    return apiError('Too many requests', 429);
  }

  // ── Parse & validate ────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = verifyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  // ── Verify Razorpay signature (CRITICAL) ────────────────────────
  const valid = verifyRazorpayPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!valid) {
    console.warn('[verify] Invalid Razorpay signature. IP:', ip, 'order:', razorpay_order_id);
    return apiError('Invalid payment signature', 400);
  }

  // ── Look up order by Razorpay order ID ─────────────────────────
  const { data: order, error: oErr } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, machine_id, drink_type, customization, amount_paise, status')
    .eq('razorpay_order_id', razorpay_order_id)
    .single();

  if (oErr || !order) {
    console.error('[verify] Order not found for rzp_order:', razorpay_order_id);
    return apiError('Order not found', 404);
  }

  // ── Idempotency: already processed? ────────────────────────────
  if (order.status === 'paid' || order.status === 'dispensing' || order.status === 'dispensed') {
    const existing = await supabaseAdmin
      .from('coffee_payments')
      .select('razorpay_payment_id')
      .eq('order_id', order.id)
      .single();
    return Response.json({ payment_id: existing.data?.razorpay_payment_id });
  }

  if (order.status !== 'pending') {
    return apiError(`Order is in "${order.status}" state`, 409);
  }

  // ── Save payment record ─────────────────────────────────────────
  const { error: pErr } = await supabaseAdmin.from('coffee_payments').insert({
    order_id:             order.id,
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    amount_paise:         order.amount_paise,
    status:               'captured',
  });

  if (pErr) {
    // Duplicate payment entry — already processed (race condition)
    if (pErr.code === '23505') {
      return Response.json({ payment_id: razorpay_payment_id });
    }
    console.error('[verify] Payment insert error:', pErr);
    return apiError('Failed to record payment', 500);
  }

  // ── Update order status ─────────────────────────────────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'paid' })
    .eq('id', order.id);

  // ── Trigger machine dispense (fire-and-forget) ─────────────────
  // We don't await this — payment confirmation to user is not blocked
  triggerDispense(
    order.id,
    order.machine_id,
    order.drink_type,
    order.customization as Record<string, unknown>,
    razorpay_payment_id,
  ).catch(err => console.error('[verify] Dispense trigger failed:', err));

  return Response.json({ payment_id: razorpay_payment_id });
}

/**
 * Call the internal dispense API route.
 * In production this would be an internal call; we use an absolute URL here
 * to keep the architecture clean and the dispense API independently testable.
 */
async function triggerDispense(
  orderId:       string,
  machineId:     string,
  drinkType:     string,
  customization: Record<string, unknown>,
  paymentId:     string,
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const secret  = process.env.MACHINE_API_SECRET;
  if (!secret) throw new Error('MACHINE_API_SECRET not set');

  const res = await fetch(`${baseUrl}/api/machine/dispense`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Machine-Token': secret,
    },
    body: JSON.stringify({
      machine_id:    machineId,
      order_id:      orderId,
      drink_type:    drinkType,
      customization,
      payment_id:    paymentId,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Dispense API returned ${res.status}: ${text}`);
  }
}
