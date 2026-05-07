import { NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createOrderSchema } from '@/lib/validators/schemas';
import { getMachineDrinkPrice, checkRateLimit, getClientIp, apiError } from '@/lib/utils/security';

export async function POST(req: NextRequest) {
  // ── Rate limit (20 req/min per IP) ─────────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`order:${ip}`, 20)) {
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

  // ── Verify machine is active ────────────────────────────────────
  const { data: machine, error: mErr } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, status, is_free, price_coffee_paise, price_tea_paise, customer_id')
    .eq('id', machine_id)
    .single();

  if (mErr || !machine)             return apiError('Machine not found', 404);
  if (machine.status !== 'active')  return apiError('Machine is not available', 409);
  if (machine.is_free)              return apiError('This machine is free — use the free-order endpoint', 409);

  // ── Resolve Razorpay keys (customer-owned keys take precedence) ─
  let rzpKeyId     = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!;
  let rzpKeySecret = process.env.RAZORPAY_KEY_SECRET!;

  if (machine.customer_id) {
    const { data: customer } = await supabaseAdmin
      .from('coffee_customers')
      .select('razorpay_key_id, razorpay_key_secret')
      .eq('id', machine.customer_id)
      .single();

    if (customer?.razorpay_key_id && customer?.razorpay_key_secret) {
      rzpKeyId     = customer.razorpay_key_id;
      rzpKeySecret = customer.razorpay_key_secret;
    }
  }

  const razorpay = new Razorpay({ key_id: rzpKeyId, key_secret: rzpKeySecret });

  // ── Calculate price ─────────────────────────────────────────────
  const amount_paise = getMachineDrinkPrice(machine, drink_type);
  if (amount_paise <= 0) return apiError('Invalid price configuration', 409);

  // ── Create internal order (before Razorpay to get our UUID) ────
  const { data: dbOrder, error: dbErr } = await supabaseAdmin
    .from('coffee_orders')
    .insert({
      machine_id,
      drink_type,
      customization: customization as Record<string, unknown>,
      amount_paise,
      status:        'pending',
    })
    .select('id, idempotency_key')
    .single();

  if (dbErr || !dbOrder) {
    console.error('[order] DB insert error:', dbErr);
    return apiError('Failed to create order', 500);
  }

  // ── Create Razorpay order ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rzpOrder: any;
  try {
    rzpOrder = await razorpay.orders.create({
      amount:   amount_paise,
      currency: 'INR',
      receipt:  dbOrder.id,
      notes: {
        internal_order_id: dbOrder.id,
        machine_id,
        drink_type,
      },
    });
  } catch (err) {
    console.error('[order] Razorpay error:', err);
    await supabaseAdmin.from('coffee_orders').delete().eq('id', dbOrder.id);
    return apiError('Payment provider error. Please try again.', 502);
  }

  // ── Store Razorpay order ID ─────────────────────────────────────
  await supabaseAdmin
    .from('coffee_orders')
    .update({ razorpay_order_id: rzpOrder.id })
    .eq('id', dbOrder.id);

  return Response.json({
    order_id:  rzpOrder.id,
    amount:    rzpOrder.amount,
    currency:  rzpOrder.currency,
    key_id:    rzpKeyId,
    internal_order_id: dbOrder.id,
  });
}
