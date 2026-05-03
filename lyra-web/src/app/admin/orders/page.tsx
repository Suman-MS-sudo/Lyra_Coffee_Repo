import { supabaseAdmin } from '@/lib/supabase-server';
import { OrdersTable } from '@/components/admin/OrdersTable';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));
  const limit = 20;
  const from = (page - 1) * limit;

  const { data, count, error } = await supabaseAdmin
    .from('coffee_orders')
    .select(
      `id, drink_type, customization, amount_paise, status, created_at,
       coffee_machines(name, location),
       coffee_payments(razorpay_payment_id, status, method, vpa)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-0.5">Orders</h1>
        <p className="text-[#7a7062] text-sm">{count ?? 0} total orders</p>
      </div>
      {error ? (
        <p className="text-red-400">Failed to load orders.</p>
      ) : (
        <OrdersTable
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          orders={(data ?? []) as any}
          total={count ?? 0}
          page={page}
          limit={limit}
        />
      )}
    </div>
  );
}
