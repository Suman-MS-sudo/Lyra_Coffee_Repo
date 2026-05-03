import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { paginationSchema } from '@/lib/validators/schemas';
import { apiError } from '@/lib/utils/security';
import { requireAdmin } from '@/lib/utils/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const { page, per_page } = paginationSchema.parse({
    page:     searchParams.get('page'),
    per_page: searchParams.get('per_page'),
  });

  const from = (page - 1) * per_page;
  const to   = from + per_page - 1;

  const { data, count, error } = await supabaseAdmin
    .from('coffee_orders')
    .select(
      `id, created_at, drink_type, customization, amount_paise, status,
       razorpay_order_id,
       coffee_machines!inner(name, location),
       coffee_payments(razorpay_payment_id, method, status)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[transactions/GET]', error);
    return apiError('Failed to fetch transactions', 500);
  }

  return Response.json({ data, total: count ?? 0, page, per_page });
}
