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

  // ── Order is now `paid`; the ESP32 long-polls /api/machine/poll
  // and will pick it up, run the recipe, then ACK back. We used to
  // self-call /api/machine/dispense over the public hostname here,
  // but that both tripped Cloudflare's bot challenge and bypassed
  // the physical machine entirely.
  console.log('[verify] queued', {
    order_id:   order.id,
    machine_id: order.machine_id,
    payment_id: razorpay_payment_id,
  });

  return Response.json({ payment_id: razorpay_payment_id });
}
