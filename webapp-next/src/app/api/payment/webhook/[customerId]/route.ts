import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyRazorpayWebhookSignature, apiError } from '@/lib/utils/security';
import { z } from 'zod';

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params;

  // ── Look up customer's webhook secret ───────────────────────────
  const { data: customer } = await supabaseAdmin
    .from('coffee_customers')
    .select('razorpay_webhook_secret, is_active')
    .eq('id', customerId)
    .single();

  if (!customer || !customer.is_active) return apiError('Not found', 404);
  if (!customer.razorpay_webhook_secret) return apiError('Webhook not configured', 400);

  // ── Read raw body for HMAC verification ────────────────────────
  const rawBody   = await req.text();
  const sigHeader = req.headers.get('x-razorpay-signature') ?? '';

  if (!sigHeader) return apiError('Missing signature', 400);

  // ── Verify against this customer's webhook secret ───────────────
  const valid = verifyRazorpayWebhookSignature(rawBody, sigHeader, customer.razorpay_webhook_secret);
  if (!valid) {
    console.warn(`[webhook/${customerId}] Invalid signature — rejected.`);
    return apiError('Invalid signature', 400);
  }

  // ── Parse body ──────────────────────────────────────────────────
  let event: unknown;
  try { event = JSON.parse(rawBody); }
  catch { return apiError('Malformed JSON', 400); }

  const parsed = paymentCapturedSchema.safeParse(event);
  if (!parsed.success) return Response.json({ status: 'ignored' });

  const { id: rzpPaymentId, order_id: rzpOrderId, method, vpa } =
    parsed.data.payload.payment.entity;

  // ── Look up internal order (must belong to this customer's machine) ──
  const { data: order } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, status, amount_paise, machine_id, drink_type, customization')
    .eq('razorpay_order_id', rzpOrderId)
    .single();

  if (!order) {
    console.warn(`[webhook/${customerId}] Unknown Razorpay order ID:`, rzpOrderId);
    return Response.json({ status: 'unknown_order' });
  }

  // ── Verify this order belongs to the customer (security check) ──
  const { data: machine } = await supabaseAdmin
    .from('coffee_machines')
    .select('customer_id')
    .eq('id', order.machine_id)
    .single();

  if (machine?.customer_id !== customerId) {
    console.warn(`[webhook/${customerId}] Order ${order.id} does not belong to this customer`);
    return apiError('Forbidden', 403);
  }

  // ── Idempotency: skip if already processed ──────────────────────
  if (order.status !== 'pending') {
    return Response.json({ status: 'already_processed' });
  }

  // ── Upsert payment ──────────────────────────────────────────────
  const { error: pErr } = await supabaseAdmin.from('coffee_payments').upsert(
    {
      order_id:             order.id,
      razorpay_payment_id:  rzpPaymentId,
      razorpay_order_id:    rzpOrderId,
      razorpay_signature:   'webhook',
      amount_paise:         order.amount_paise,
      status:               'captured',
      method:               method ?? null,
      vpa: vpa ? '@' + (vpa.split('@')[1] ?? vpa) : null,
    },
    { onConflict: 'razorpay_payment_id' },
  );

  if (pErr && pErr.code !== '23505') {
    console.error(`[webhook/${customerId}] Payment upsert error:`, pErr);
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  // ── Mark order paid + log dispense ─────────────────────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'paid' })
    .eq('id', order.id);

  await supabaseAdmin.from('coffee_dispense_log').insert({
    order_id:   order.id,
    machine_id: order.machine_id,
    status:     'queued',
    attempt:    1,
  });

  console.log(`[webhook/${customerId}] Order ${order.id} paid. Payment: ${rzpPaymentId}`);

  return Response.json({ status: 'ok' });
}
