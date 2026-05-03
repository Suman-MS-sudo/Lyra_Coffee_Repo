import { supabaseAdmin } from '@/lib/supabase/server';
import TransactionsTable from '@/components/admin/TransactionsTable';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Transactions' };

export default async function TransactionsPage() {
  const { data: raw } = await supabaseAdmin
    .from('coffee_orders')
    .select(`
      id, created_at, drink_type, customization, amount_paise, status,
      coffee_machines(name, location),
      coffee_payments(razorpay_payment_id, method, status)
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  // Normalise joined rows: supabase may return relations as array or single object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = (raw ?? []).map((row: any) => ({
    ...row,
    coffee_machines: Array.isArray(row.coffee_machines)
      ? (row.coffee_machines[0] ?? null)
      : (row.coffee_machines ?? null),
  }));

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 lg:mb-8">Transactions</h1>
      <TransactionsTable orders={orders} />
    </div>
  );
}
