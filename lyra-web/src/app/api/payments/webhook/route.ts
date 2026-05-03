// ================================================================
//  POST /api/payments/webhook
//  Razorpay server-to-server webhook — handles payment.captured,
//  payment.failed, refund.processed events.
//  This is the authoritative source of payment truth.
// ================================================================
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { verifyWebhookSignature } from '@/lib/utils';

export const runtime = 'nodejs';

// Razorpay sends JSON with Content-Type application/json
// We need the raw body for HMAC verification — use text()
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  // ── 1. Verify webhook authenticity ────────────────────────────
  let valid: boolean;
  try {
    valid = verifyWebhookSignature(rawBody, signature);
  } catch {
    return Response.json({ error: 'Signature error' }, { status: 400 });
  }
  if (!valid) {
    console.warn('[webhook] Invalid signature');
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let event: { event: string; payload: { payment?: { entity: RazorpayPaymentEntity } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  if (!entity) {
    return Response.json({ received: true }); // unknown event shape — ack immediately
  }

  const rzpOrderId = entity.order_id;
  const rzpPaymentId = entity.id;
  const eventType = event.event;

  // ── 2. Find our order ─────────────────────────────────────────
  const { data: order } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, status, machine_id, drink_type, customization')
    .eq('razorpay_order_id', rzpOrderId)
    .single();

  if (!order) {
    // Ack to prevent Razorpay retries, but log it
    console.warn('[webhook] Order not found for Razorpay order', rzpOrderId);
    return Response.json({ received: true });
  }

  // ── 3. Store raw webhook payload ──────────────────────────────
  await supabaseAdmin.from('coffee_payments').upsert({
    order_id: order.id,
    razorpay_payment_id: rzpPaymentId,
    razorpay_order_id: rzpOrderId,
    status: eventType === 'payment.captured' ? 'captured' : 'failed',
    method: entity.method,
    vpa: entity.vpa ?? null,
    error_code: entity.error_code ?? null,
    error_description: entity.error_description ?? null,
    raw_webhook: event as unknown as Record<string, unknown>,
  }, { onConflict: 'razorpay_payment_id' });

  // ── 4. Handle event types ─────────────────────────────────────
  if (eventType === 'payment.captured') {
    // If verify-payment already processed this, status will be paid/dispensing
    if (order.status === 'pending') {
      await supabaseAdmin
        .from('coffee_orders')
        .update({ status: 'paid' })
        .eq('id', order.id);

      // Trigger dispense if not already triggered via verify endpoint
      await triggerDispenseInternal(order);
    }
  } else if (eventType === 'payment.failed') {
    if (order.status === 'pending') {
      await supabaseAdmin
        .from('coffee_orders')
        .update({ status: 'failed' })
        .eq('id', order.id);
    }
  }

  return Response.json({ received: true });
}

// ── Internal trigger (same process, no HTTP round-trip) ───────────
async function triggerDispenseInternal(order: {
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
    payment_id: order.id,
  });

  const hmac = (await import('crypto')).default
    .createHmac('sha256', process.env.MACHINE_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  fetch(`${baseUrl}/api/machine/dispense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dispense-signature': hmac },
    body: payload,
  }).catch(e => console.error('[webhook] dispense trigger failed', e));
}

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  method: string;
  vpa?: string;
  error_code?: string;
  error_description?: string;
}
