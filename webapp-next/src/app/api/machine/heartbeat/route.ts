import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { authenticateMachine } from '@/lib/utils/machine-auth';
import { apiError } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

/**
 * POST /api/machine/heartbeat
 *
 * Lightweight keep-alive sent by the ESP32 every minute or so.
 * Updates `last_seen_at` and returns a tiny payload so the firmware
 * can compare clocks / detect server health.
 *
 * Auth: Authorization: Bearer <api_key>, X-Machine-Id: <uuid>
 */
export async function POST(req: NextRequest) {
  const ua  = req.headers.get('user-agent') ?? '';
  const mid = req.headers.get('x-machine-id') ?? '';
  console.log('[machine/heartbeat] hit', { mid, ua });

  const auth = await authenticateMachine(req);
  if (!auth.ok) {
    console.warn('[machine/heartbeat] auth failed', { mid });
    return auth.res;
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('coffee_machines')
    .update({ last_seen_at: now })
    .eq('id', auth.machineId)
    .select('id, last_seen_at');

  if (error) {
    console.error('[machine/heartbeat]', error);
    return apiError('DB error', 500);
  }
  console.log('[machine/heartbeat] ok', {
    mid:       auth.machineId,
    rows:      updated?.length ?? 0,
    written:   now,
    readback:  updated?.[0]?.last_seen_at ?? null,
  });
  return Response.json(
    { ok: true, server_time: now },
    {
      headers: {
        'Cache-Control':                 'no-store',
        'CDN-Cache-Control':             'no-store',
        'Cloudflare-CDN-Cache-Control':  'no-store',
      },
    },
  );
}
