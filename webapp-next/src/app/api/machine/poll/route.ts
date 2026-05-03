import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticateMachine } from '@/lib/utils/machine-auth';
import { apiError } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

/**
 * GET /api/machine/poll
 *
 * Called repeatedly by the ESP32. Returns the oldest paid order
 * for this machine and atomically marks it `dispensing`. If there
 * is nothing to do, returns 204 No Content.
 *
 * Auth: Authorization: Bearer <api_key>, X-Machine-Id: <uuid>
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateMachine(req);
  if (!auth.ok) return auth.res;

  // Pick oldest paid order for this machine.
  const { data: order, error } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, drink_type, customization, status')
    .eq('machine_id', auth.machineId)
    .eq('status', 'paid')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[machine/poll] select', error);
    return apiError('DB error', 500);
  }
  if (!order) return new Response(null, { status: 204 });

  // Atomically claim it: only flip paid → dispensing.
  const { data: claimed, error: upErr } = await supabaseAdmin
    .from('coffee_orders')
    .update({ status: 'dispensing' })
    .eq('id', order.id)
    .eq('status', 'paid')
    .select('id')
    .maybeSingle();

  if (upErr || !claimed) {
    // Lost the race — someone else (or another poll) took it.
    return new Response(null, { status: 204 });
  }

  // Log a dispense attempt
  await supabaseAdmin.from('coffee_dispense_log').insert({
    order_id:   order.id,
    machine_id: auth.machineId,
    status:     'sent',
    attempt:    1,
  });

  return Response.json({
    order_id:      order.id,
    drink_type:    order.drink_type,
    customization: order.customization,
  });
}
