import { NextRequest } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
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
  noStore();
  const auth = await authenticateMachine(req);
  if (!auth.ok) return auth.res;

  // Every poll counts as a liveness ping.
  const { error: pingErr } = await supabaseAdmin
    .from('coffee_machines')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', auth.machineId);
  if (pingErr) console.error('[machine/poll] last_seen_at update failed', pingErr);

  // ── Stuck-order recovery ─────────────────────────────────────
  // If a previous poll claimed an order (paid → dispensing) but the
  // TLS response never reached the ESP, the order would sit in
  // `dispensing` forever and the customer page would hang on
  // "Brewing…". Re-deliver any of THIS machine's orders that have
  // been in `dispensing` for more than STUCK_DISPENSING_MS without
  // an ack. The firmware just re-runs the recipe and acks — same
  // physical outcome as the original lost reply.
  const STUCK_DISPENSING_MS = 30_000;
  const stuckCutoff = new Date(Date.now() - STUCK_DISPENSING_MS).toISOString();

  const { data: stuck } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, drink_type, customization, updated_at')
    .eq('machine_id', auth.machineId)
    .eq('status', 'dispensing')
    .lt('updated_at', stuckCutoff)
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (stuck) {
    // Bump updated_at so we don't replay every 3 s while the ESP is
    // running the recipe. STUCK_DISPENSING_MS gives it room to ack.
    await supabaseAdmin
      .from('coffee_orders')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', stuck.id);

    await supabaseAdmin.from('coffee_dispense_log').insert({
      order_id:   stuck.id,
      machine_id: auth.machineId,
      status:     'sent',
      attempt:    2,
      error_message: 'redelivered after stuck dispensing window',
    });

    console.warn('[machine/poll] redelivering stuck order', stuck.id);

    return Response.json({
      order_id:      stuck.id,
      drink_type:    stuck.drink_type,
      customization: stuck.customization,
    });
  }

  // ── Fresh paid order ─────────────────────────────────────────
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
  if (!order) {
    // Explicit no-store so Cloudflare never caches an empty 204 for
    // a machine that's actively waiting on a fresh order.
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control':                'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control':            'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
      },
    });
  }
  console.log('[machine/poll] delivering', { mid: auth.machineId, order_id: order.id });

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
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control':                'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control':            'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
      },
    });
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
