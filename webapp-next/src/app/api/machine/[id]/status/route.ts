import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import { apiError } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

/**
 * GET /api/machine/[id]/status
 *
 * Public, unauthenticated read of a machine's liveness so the
 * customer-facing order page can show an online/offline chip
 * without exposing API keys or full machine rows.
 *
 * Response:
 *   { id, status, last_seen_at, online, server_time }
 *
 * `online` is true iff last_seen_at is within 90 seconds.
 */
const ONLINE_THRESHOLD_MS = 90_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid machine ID', 400);

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, status, last_seen_at')
    .eq('id', parsed.data)
    .single();

  if (error || !data) return apiError('Machine not found', 404);

  const lastMs = data.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
  const online = lastMs > 0 && Date.now() - lastMs < ONLINE_THRESHOLD_MS;

  return Response.json({
    id:           data.id,
    status:       data.status,
    last_seen_at: data.last_seen_at,
    online,
    server_time:  new Date().toISOString(),
  });
}
