import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createOrderSchema } from '@/lib/validators/schemas';
import { checkRateLimit, getClientIp, apiError } from '@/lib/utils/security';

/**
 * POST /api/payment/free-order
 *
 * Used for machines flagged as `is_free = true`. No Razorpay charge —
 * we create an internal order in the `paid` state and immediately
 * trigger dispense, mirroring the post-verify flow.
 */
export async function POST(req: NextRequest) {
  // ── Rate limit (10 free orders/min per IP) ─────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`free-order:${ip}`, 10)) {
    return apiError('Too many requests. Please slow down.', 429);
  }

  // ── Parse & validate ────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }
  const { machine_id, drink_type, customization } = parsed.data;

  // ── Verify machine is active AND actually marked free ──────────
  const { data: machine, error: mErr } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, status, is_free')
    .eq('id', machine_id)
    .single();

  if (mErr || !machine)            return apiError('Machine not found', 404);
  if (machine.status !== 'active') return apiError('Machine is not available', 409);
  if (!machine.is_free)            return apiError('This machine requires payment', 409);

  // ── Create order directly in `paid` state ──────────────────────
  const { data: dbOrder, error: dbErr } = await supabaseAdmin
    .from('coffee_orders')
    .insert({
      machine_id,
      drink_type,
      customization: customization as Record<string, unknown>,
      amount_paise:  1,        // schema requires > 0; we treat as token value
      status:        'paid',
    })
    .select('id')
    .single();

  if (dbErr || !dbOrder) {
    console.error('[free-order] DB insert error:', dbErr);
    return apiError('Failed to place order', 500);
  }

  // ── Trigger dispense (fire-and-forget) ──────────────────────────
  triggerDispense(
    dbOrder.id,
    machine_id,
    drink_type,
    customization as Record<string, unknown>,
    `free_${dbOrder.id}`,
  ).catch(err => console.error('[free-order] Dispense trigger failed:', err));

  return Response.json({ order_id: dbOrder.id });
}

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
