import { NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generateMachineApiKey, apiError } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

/**
 * POST /api/machine/identify
 *
 * Called by the ESP32 on first boot. The firmware sends its hardware
 * MAC address; we look up the matching `coffee_machines` row, mint a
 * fresh API key (rotating any prior one) and return:
 *
 *   {
 *     id, api_key, name, location,
 *     is_free, price_coffee_paise, price_tea_paise
 *   }
 *
 * The plaintext key is shown ONCE — the firmware persists it to NVS
 * and uses it for all subsequent /poll and /ack calls.
 *
 * Re-provisioning: returns 409 once a machine has been claimed.
 * An admin must clear `mac_provisioned_at` (via PATCH /admin/machines/[id])
 * to allow a replacement board to claim the same MAC.
 */
const bodySchema = z.object({
  mac_id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9:_\-]+$/, 'invalid mac_id format'),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  // Normalise to upper-case so 'aa:bb…' and 'AA:BB…' match the same row.
  const macId = parsed.data.mac_id.toUpperCase();

  const { data: machine, error } = await supabaseAdmin
    .from('coffee_machines')
    .select(
      'id, name, location, status, mac_provisioned_at, is_free, price_coffee_paise, price_tea_paise',
    )
    .eq('mac_id', macId)
    .maybeSingle();

  if (error) {
    console.error('[machine/identify]', error);
    return apiError('DB error', 500);
  }
  if (!machine) {
    return apiError(`No machine registered with mac_id="${macId}"`, 404);
  }

  if (machine.mac_provisioned_at) {
    return apiError('Machine already provisioned. Ask an admin to reset.', 409);
  }

  // Mint a fresh API key, persist hash, lock to this MAC.
  const { key, hash } = generateMachineApiKey();

  const { error: upErr } = await supabaseAdmin
    .from('coffee_machines')
    .update({
      api_key_hash:        hash,
      mac_provisioned_at:  new Date().toISOString(),
    })
    .eq('id', machine.id);

  if (upErr) {
    console.error('[machine/identify] update', upErr);
    return apiError('Failed to provision machine', 500);
  }

  return Response.json({
    id:                 machine.id,
    api_key:            key,
    name:               machine.name,
    location:           machine.location,
    is_free:            machine.is_free,
    price_coffee_paise: machine.price_coffee_paise,
    price_tea_paise:    machine.price_tea_paise,
  });
}
