import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { apiError } from '@/lib/utils/security';
import { z } from 'zod';

const patchSchema = z.object({
  status:      z.enum(['active', 'inactive', 'maintenance']).optional(),
  name:        z.string().min(1).max(120).trim().optional(),
  location:    z.string().max(255).trim().nullable().optional(),
  customer_id: z.union([uuidSchema, z.null()]).optional(),
  is_free:     z.boolean().optional(),
  price_coffee_paise: z.number().int().min(0).max(100_000).nullable().optional(),
  price_tea_paise:    z.number().int().min(0).max(100_000).nullable().optional(),
  price_milk_paise:   z.number().int().min(0).max(100_000).nullable().optional(),
  mac_id:      z.string().trim().max(64).regex(/^[A-Za-z0-9:_\-]+$/).nullable().optional(),
  // null clears the timestamp so the next ESP32 to call /identify
  // with this MAC can re-provision (e.g. after a board swap).
  reset_provisioning: z.literal(true).optional(),
});

// ── PATCH /api/admin/machines/[id] ─────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid machine ID', 400);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const bodyParsed = patchSchema.safeParse(body);
  if (!bodyParsed.success) {
    return apiError(bodyParsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  // Translate the convenience flag into an explicit timestamp clear.
  const { reset_provisioning, ...rest } = bodyParsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (reset_provisioning) updates.mac_provisioned_at = null;

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .update(updates)
    .eq('id', parsed.data)
    .select(
      'id, name, location, status, customer_id, is_free, price_coffee_paise, price_tea_paise, price_milk_paise, mac_id, mac_provisioned_at, updated_at',
    )
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return apiError('A machine with this MAC ID already exists', 409);
    }
    return apiError(`Failed to update machine: ${error.message}`, 500);
  }
  return Response.json(data);
}

// ── DELETE /api/admin/machines/[id] ────────────────────────────
// ?force=true also wipes dependent orders / payments / dispense logs.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid machine ID', 400);

  const machineId = parsed.data;
  const force     = new URL(req.url).searchParams.get('force') === 'true';

  // If force, clean up children first. Order matters: payments → dispense_log → orders.
  if (force) {
    // Find order ids for this machine to cascade payments
    const { data: orderRows } = await supabaseAdmin
      .from('coffee_orders')
      .select('id')
      .eq('machine_id', machineId);
    const orderIds = (orderRows ?? []).map((r: { id: string }) => r.id);

    if (orderIds.length > 0) {
      const { error: payErr } = await supabaseAdmin
        .from('coffee_payments').delete().in('order_id', orderIds);
      if (payErr) return apiError(`Failed to delete payments: ${payErr.message}`, 500);
    }

    const { error: dispErr } = await supabaseAdmin
      .from('coffee_dispense_log').delete().eq('machine_id', machineId);
    if (dispErr) return apiError(`Failed to delete dispense log: ${dispErr.message}`, 500);

    const { error: ordErr } = await supabaseAdmin
      .from('coffee_orders').delete().eq('machine_id', machineId);
    if (ordErr) return apiError(`Failed to delete orders: ${ordErr.message}`, 500);
  }

  const { error } = await supabaseAdmin
    .from('coffee_machines')
    .delete()
    .eq('id', machineId);

  if (error) {
    // 23503 = foreign_key_violation
    const code = (error as { code?: string }).code;
    if (code === '23503') {
      return apiError(
        'Machine has linked orders or dispense history. Retry with “force delete” to remove them, or disable the machine instead.',
        409,
      );
    }
    return apiError(`Failed to delete machine: ${error.message}`, 500);
  }
  return Response.json({ ok: true });
}
