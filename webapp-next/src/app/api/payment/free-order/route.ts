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

  // ── Mark as ready for the machine to pick up via /api/machine/poll ─
  // The ESP32 long-polls for orders in `paid` status, runs the recipe,
  // and ACKs back. No need to self-call dispense here (which used to
  // fetch through the public hostname and tripped Cloudflare's bot
  // challenge).
  console.log('[free-order] queued', {
    order_id:   dbOrder.id,
    machine_id,
    drink_type,
    payment_id: `free_${dbOrder.id}`,
  });

  return Response.json({ order_id: dbOrder.id });
}
