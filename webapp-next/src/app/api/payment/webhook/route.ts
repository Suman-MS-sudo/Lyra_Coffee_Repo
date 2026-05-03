import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyRazorpayWebhookSignature, apiError } from '@/lib/utils/security';
import { z } from 'zod';

// Next.js App Router: disable body autoparse so we can read raw bytes
export const dynamic = 'force-dynamic';

const paymentCapturedSchema = z.object({
  event: z.literal('payment.captured'),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id:       z.string(),
        order_id: z.string(),
        amount:   z.number(),
        method:   z.string().optional(),
        vpa:      z.string().optional(),
      }),
    }),
  }),
});

export async function POST(req: NextRequest) {
  // ── Read raw body for HMAC verification ────────────────────────
  const rawBody  = await req.text();
  const sigHeader = req.headers.get('x-razorpay-signature') ?? '';

  if (!sigHeader) return apiError('Missing signature', 400);

  // ── Verify webhook signature ────────────────────────────────────
  const valid = verifyRazorpayWebhookSignature(rawBody, sigHeader);
  if (!valid) {
    console.warn('[webhook] Invalid signature — rejected.');
    return apiError('Invalid signature', 400);
  }

  // ── Parse body ──────────────────────────────────────────────────
  let event: unknown;
  try { event = JSON.parse(rawBody); }
  catch { return apiError('Malformed JSON', 400); }

  const parsed = paymentCapturedSchema.safeParse(event);
  if (!parsed.success) {
    // Non-payment.captured events — acknowledge and ignore
    return Response.json({ status: 'ignored' });
  }

  const { id: rzpPaymentId, order_id: rzpOrderId, method, vpa } =
    parsed.data.payload.payment.entity;

  // ── Look up internal order ──────────────────────────────────────
  const { data: order } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, status, amount_paise, machine_id, drink_type, customization')
    .eq('razorpay_order_id', rzpOrderId)
    .single();

  if (!order) {
    console.warn('[webhook] Unknown Razorpay order ID:', rzpOrderId);
    // Acknowledge to stop Razorpay retries
    return Response.json({ status: 'unknown_order' });
  }

  // ── Idempotency: skip if already processed ──────────────────────
  if (order.status !== 'pending') {
    return Response.json({ status: 'already_processed' });
  }

  // ── Upsert payment (idempotent via UNIQUE constraint) ───────────
  const { error: pErr } = await supabaseAdmin.from('coffee_payments').upsert(
    {
      order_id:             order.id,
      razorpay_payment_id:  rzpPaymentId,
      razorpay_order_id:    rzpOrderId,
      razorpay_signature:   'webhook',     // no client signature in webhook flow
      amount_paise:         order.amount_paise,
      status:               'captured',
      method:               method ?? null,
      // Mask VPA: store only domain part, e.g. "@okaxis"
      vpa: vpa ? '@' + (vpa.split('@')[1] ?? vpa) : null,
    },
    { onConflict: 'razorpay_payment_id' },
  );

  if (pErr && pErr.code !== '23505') {
    console.error('[webhook] Payment upsert error:', pErr);
    // Return 500 so Razorpay retries
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  // ── Update order to paid ────────────────────────────────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'paid' })
    .eq('id', order.id);

  // ── Log dispense and update to dispensing ──────────────────────
  await supabaseAdmin.from('coffee_dispense_log').insert({
    order_id:   order.id,
    machine_id: order.machine_id,
    status:     'queued',
    attempt:    1,
  });

  console.log(`[webhook] Order ${order.id} paid. Payment: ${rzpPaymentId}`);

  return Response.json({ status: 'ok' });
}
