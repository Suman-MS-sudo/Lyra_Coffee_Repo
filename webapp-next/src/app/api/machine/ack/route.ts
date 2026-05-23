import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticateMachine } from '@/lib/utils/machine-auth';
import { uuidSchema } from '@/lib/validators/schemas';
import { apiError } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

const ackSchema = z.object({
  order_id: uuidSchema,
  status:   z.enum(['dispensed', 'failed']),
  error:    z.string().max(500).optional(),
});

/**
 * POST /api/machine/ack
 *
 * Called by the ESP32 after a dispense attempt finishes (or fails).
 * Updates the order + dispense log.
 *
 * Auth: Authorization: Bearer <api_key>, X-Machine-Id: <uuid>
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateMachine(req);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }
  const { order_id, status, error } = parsed.data;

  // Verify the order belongs to this machine and is in the expected state.
  const { data: row } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, machine_id, status')
    .eq('id', order_id)
    .maybeSingle();

  if (!row || row.machine_id !== auth.machineId) {
    return apiError('Order not found for this machine', 404);
  }

  // Idempotent: already in a terminal state — return success without re-writing.
  if (row.status === 'dispensed' || row.status === 'failed') {
    return Response.json({ ok: true });
  }

  if (row.status !== 'dispensing') {
    return apiError(`Cannot ACK order in "${row.status}" state`, 409);
  }

  await supabaseAdmin
    .from('coffee_orders')
    .update({ status })
    .eq('id', order_id)
    .eq('status', 'dispensing'); // guard against races

  const { data: lastLog } = await supabaseAdmin
    .from('coffee_dispense_log')
    .select('attempt')
    .eq('order_id', order_id)
    .eq('machine_id', auth.machineId)
    .order('attempt', { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabaseAdmin
    .from('coffee_dispense_log')
    .insert({
      order_id,
      machine_id:    auth.machineId,
      status:        status === 'dispensed' ? 'ack' : 'failed',
      attempt:       lastLog?.attempt ?? 1,
      error_message: error ?? null,
    });

  return Response.json({ ok: true });
}
