// ================================================================
//  GET /api/admin/orders — paginated order list with payment info
// ================================================================
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { apiError, apiOk } from '@/lib/utils';
import { requireAdmin } from '@/lib/require-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const from = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('coffee_orders')
    .select(
      `id, drink_type, customization, amount_paise, status, created_at,
       coffee_machines(name, location),
       coffee_payments(razorpay_payment_id, status, method, vpa)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return apiError('Failed to fetch orders', 500);

  return apiOk({
    orders: data,
    total: count ?? 0,
    page,
    limit,
  });
}
