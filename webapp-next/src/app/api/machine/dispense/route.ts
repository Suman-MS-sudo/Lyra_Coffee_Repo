import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dispenseSchema } from '@/lib/validators/schemas';
import { apiError } from '@/lib/utils/security';
import crypto from 'crypto';

/**
 * POST /api/machine/dispense
 *
 * Secure endpoint that triggers a drink dispense on a machine.
 * Called internally by the verify route after successful payment.
 * Can also be called by the ESP32/backend after MQTT confirmation.
 *
 * Security:
 *  - X-Machine-Token header: shared secret verified by constant-time compare
 *  - order_id idempotency: same order cannot be dispensed twice
 *  - machine must be active
 */
export async function POST(req: NextRequest) {
  // ── Token verification ──────────────────────────────────────────
  const token  = req.headers.get('x-machine-token') ?? '';
  const secret = process.env.MACHINE_API_SECRET ?? '';

  if (!secret) {
    console.error('[dispense] MACHINE_API_SECRET not set');
    return apiError('Server config error', 500);
  }

  // Timing-safe compare
  let tokenValid = false;
  try {
    tokenValid = crypto.timingSafeEqual(
      Buffer.from(token,  'utf8'),
      Buffer.from(secret, 'utf8'),
    );
  } catch {
    tokenValid = false;
  }

  if (!tokenValid) {
    console.warn('[dispense] Unauthorized request — invalid token');
    return apiError('Unauthorized', 401);
  }

  // ── Parse & validate ────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = dispenseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }
  const { machine_id, order_id, drink_type, customization, payment_id } = parsed.data;

  // ── Load order — verify it belongs to this machine and is paid ──
  const { data: order, error: oErr } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, machine_id, status')
    .eq('id', order_id)
    .single();

  if (oErr || !order)               return apiError('Order not found', 404);
  if (order.machine_id !== machine_id) return apiError('Machine/order mismatch', 400);

  // ── Idempotency: already dispensed? ────────────────────────────
  if (order.status === 'dispensed') {
    return Response.json({ status: 'already_dispensed', order_id });
  }
  if (order.status !== 'paid' && order.status !== 'dispensing') {
    return apiError(`Cannot dispense order in status "${order.status}"`, 409);
  }

  // ── Verify machine is active ────────────────────────────────────
  const { data: machine } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, status')
    .eq('id', machine_id)
    .single();

  if (!machine || machine.status !== 'active') {
    return apiError('Machine is not available', 409);
  }

  // ── Update order to dispensing ──────────────────────────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'dispensing' })
    .eq('id', order_id);

  // ── Log dispense attempt ────────────────────────────────────────
  const { data: logEntry } = await supabaseAdmin
    .from('coffee_dispense_log')
    .insert({
      order_id,
      machine_id,
      status:  'sent',
      attempt: 1,
    })
    .select('id')
    .single();

  // ── MOCK: actual machine communication ──────────────────────────
  // In production, replace this block with your MQTT publish,
  // HTTP call to the machine, or whichever protocol you use.
  console.log('[dispense] DISPATCH:', {
    order_id,
    machine_id,
    drink_type,
    customization,
    payment_id,
  });

  // Simulate success
  const dispatchOk = true;

  // ── Update status based on dispatch result ───────────────────────
  if (dispatchOk) {
    await Promise.all([
      supabaseAdmin
        .from('coffee_orders')
        .update({ status: 'dispensed' })
        .eq('id', order_id),
      logEntry
        ? supabaseAdmin
            .from('coffee_dispense_log')
            .update({ status: 'ack' })
            .eq('id', logEntry.id)
        : Promise.resolve(),
    ]);

    return Response.json({ status: 'dispatched', order_id });
  } else {
    await supabaseAdmin
      .from('coffee_orders')
      .update({ status: 'failed' })
      .eq('id', order_id);

    return apiError('Machine dispatch failed', 502);
  }
}
