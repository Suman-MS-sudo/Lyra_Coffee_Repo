// ================================================================
//  POST /api/machine/dispense
//  Internal endpoint — called by the payment server after verification.
//  Sends the dispense command to the physical machine (via MQTT/HTTP).
//
//  Security:
//    - Authenticated via HMAC-SHA256 (x-dispense-signature header)
//    - Idempotent: same order_id can only be dispatched once
// ================================================================
import { NextRequest } from 'next/server';
import { dispenseSchema } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabase-server';
import { apiError, apiOk } from '@/lib/utils';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ── 1. Authenticate with HMAC ─────────────────────────────────
  const rawBody = await req.text();
  const incomingSig = req.headers.get('x-dispense-signature') ?? '';

  const expectedSig = crypto
    .createHmac('sha256', process.env.MACHINE_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  const incomingBuf = Buffer.from(incomingSig);
  const expectedBuf = Buffer.from(expectedSig);
  const sigOk =
    incomingBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(incomingBuf, expectedBuf);

  if (!sigOk) return apiError('Unauthorized', 401);

  // ── 2. Validate body ──────────────────────────────────────────
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return apiError('Invalid JSON'); }

  const parsed = dispenseSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error');

  const { machine_id, order_id, drink_type, customization, payment_id } = parsed.data;

  // ── 3. Idempotency check ──────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('coffee_dispense_log')
    .select('id, status')
    .eq('order_id', order_id)
    .eq('status', 'sent')
    .maybeSingle();

  if (existing) {
    return apiOk({ status: 'already_dispatched', order_id });
  }

  // ── 4. Verify order is in paid state ──────────────────────────
  const { data: order } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, status, machine_id')
    .eq('id', order_id)
    .single();

  if (!order) return apiError('Order not found', 404);
  if (order.machine_id !== machine_id) return apiError('Machine mismatch', 400);
  if (order.status !== 'paid') return apiError(`Order status is ${order.status}`, 409);

  // ── 5. Load machine API credentials ──────────────────────────
  const { data: machine } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, status, api_key, api_secret')
    .eq('id', machine_id)
    .single();

  if (!machine || machine.status !== 'active') return apiError('Machine unavailable', 503);

  // ── 6. Update order to dispensing ────────────────────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'dispensing', dispense_attempts: 1 })
    .eq('id', order_id);

  // ── 7. Log dispense attempt ───────────────────────────────────
  await supabaseAdmin.from('coffee_dispense_log').insert({
    order_id,
    machine_id,
    attempt: 1,
    status: 'sent',
  });

  // ── 8. Send command to machine ────────────────────────────────
  // In production this would call the machine's local IP or MQTT broker.
  // For now we log and mock success.
  const dispensePayload = {
    order_id,
    drink_type,
    customization,
    payment_id,
    timestamp: new Date().toISOString(),
  };

  console.log('[dispense] Sending to machine', machine_id, dispensePayload);

  // TODO: Replace with real machine call:
  // const machineRes = await sendToMachine(machine.api_key, machine.api_secret, dispensePayload);

  // ── 9. Update order to dispensed (mock success) ───────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'dispensed' })
    .eq('id', order_id);

  await supabaseAdmin
    .from('coffee_dispense_log')
    .update({ status: 'ack', response: { mocked: true } })
    .eq('order_id', order_id)
    .eq('attempt', 1);

  return apiOk({ status: 'dispatched', order_id });
}
