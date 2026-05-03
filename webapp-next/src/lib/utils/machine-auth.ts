import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashApiKey, apiError } from '@/lib/utils/security';
import { uuidSchema } from '@/lib/validators/schemas';
import crypto from 'crypto';

/**
 * Authenticate an inbound request from a physical machine.
 *
 * The ESP32 sends:
 *   Authorization: Bearer <plaintext api_key>
 *   X-Machine-Id : <uuid>
 *
 * We hash the bearer token and timing-safe-compare against
 * the row's api_key_hash. Returns the machine row on success
 * or a Response object on failure (caller should `return` it).
 */
export async function authenticateMachine(req: NextRequest): Promise<
  | { ok: true;  machineId: string }
  | { ok: false; res: Response }
> {
  const auth      = req.headers.get('authorization') ?? '';
  const machineId = req.headers.get('x-machine-id')  ?? '';
  const bearer    = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';

  if (!bearer || !machineId) {
    return { ok: false, res: apiError('Unauthorized', 401) };
  }
  const idCheck = uuidSchema.safeParse(machineId);
  if (!idCheck.success) {
    return { ok: false, res: apiError('Invalid machine id', 400) };
  }

  const { data: row, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, api_key_hash, status')
    .eq('id', idCheck.data)
    .single();

  if (error || !row) {
    return { ok: false, res: apiError('Unauthorized', 401) };
  }

  const provided = hashApiKey(bearer);
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(provided,        'hex'),
      Buffer.from(row.api_key_hash, 'hex'),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    return { ok: false, res: apiError('Unauthorized', 401) };
  }

  return { ok: true, machineId: row.id };
}
