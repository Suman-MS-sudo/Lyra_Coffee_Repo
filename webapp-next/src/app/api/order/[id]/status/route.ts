import { NextRequest } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import { apiError } from '@/lib/utils/security';

export const dynamic = 'force-dynamic';

/**
 * GET /api/order/[id]/status
 *
 * Public, unauthenticated read of an order's lifecycle state so the
 * customer success screen can flip from "Brewing…" to "Completed"
 * (or "Failed") without exposing payment internals.
 *
 * Response: { id, status }
 *   status ∈ pending | paid | dispensing | dispensed | failed | refunded
 *
 * Order IDs are unguessable UUIDs, so this is safe to expose without
 * a session — the same way the existing /api/machine/[id]/status is
 * publicly readable for the online chip.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  noStore();
  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid order ID', 400);

  const { data, error } = await supabaseAdmin
    .from('coffee_orders')
    .select('id, status')
    .eq('id', parsed.data)
    .single();

  if (error || !data) return apiError('Order not found', 404);

  return Response.json(
    { id: data.id, status: data.status },
    {
      headers: {
        'Cache-Control':                'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control':            'no-store',
        'Cloudflare-CDN-Cache-Control': 'no-store',
      },
    },
  );
}
