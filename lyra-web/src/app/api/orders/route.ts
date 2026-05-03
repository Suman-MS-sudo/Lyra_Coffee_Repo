// ================================================================
//  POST /api/orders
//  Creates a Razorpay order and persists a coffee_order row.
// ================================================================
import { NextRequest } from 'next/server';
import { createOrderSchema } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabase-server';
import { razorpay } from '@/lib/razorpay';
import { calculatePrice, isRateLimited, getClientIp, apiError, apiOk } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // ── 1. Rate limit ─────────────────────────────────────────────
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return apiError('Too many requests', 429);
  }

  // ── 2. Parse & validate body ──────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Validation error');
  }
  const { machine_id, drink_type, customization } = parsed.data;

  // ── 3. Verify machine exists and is active ─────────────────────
  const { data: machine, error: machineErr } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, status')
    .eq('id', machine_id)
    .single();

  if (machineErr || !machine) return apiError('Machine not found', 404);
  if (machine.status !== 'active') return apiError('Machine is not available', 503);

  // ── 4. Calculate price ────────────────────────────────────────
  const amount_paise = calculatePrice(drink_type, customization);

  // ── 5. Create Razorpay order ──────────────────────────────────
  let rzpOrder: { id: string };
  try {
    rzpOrder = await razorpay.orders.create({
      amount: amount_paise,
      currency: 'INR',
      receipt: `lyra-${Date.now()}`,
      notes: { machine_id, drink_type },
    }) as { id: string };
  } catch (e) {
    console.error('[orders] Razorpay create order failed', e);
    return apiError('Payment gateway error', 502);
  }

  // ── 6. Persist to Supabase ────────────────────────────────────
  const { data: order, error: dbErr } = await supabaseAdmin
    .from('coffee_orders')
    .insert({
      machine_id,
      drink_type,
      customization,
      amount_paise,
      status: 'pending',
      razorpay_order_id: rzpOrder.id,
    })
    .select('id')
    .single();

  if (dbErr || !order) {
    console.error('[orders] DB insert failed', dbErr);
    return apiError('Order creation failed', 500);
  }

  return apiOk({
    order_id: order.id,
    razorpay_order_id: rzpOrder.id,
    amount_paise,
    currency: 'INR',
    razorpay_key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  }, 201);
}
