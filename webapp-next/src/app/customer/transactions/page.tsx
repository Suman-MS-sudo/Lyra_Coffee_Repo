import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Clock, IndianRupee, Smartphone } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Transactions' };

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  paid:       'bg-blue-500/15 text-blue-400 border-blue-500/20',
  dispensing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  dispensed:  'bg-green-500/15 text-green-400 border-green-500/20',
  failed:     'bg-red-500/15 text-red-400 border-red-500/20',
  refunded:   'bg-white/10 text-white/40 border-white/10',
};

const DRINK_LABEL: Record<string, string> = { coffee: 'Coffee', tea: 'Tea', milk: 'Milk' };

function fmtMethod(m: string | null | undefined) {
  if (!m) return '—';
  return m === 'upi' ? 'UPI' : m === 'card' ? 'Card' : m === 'netbanking' ? 'Net Banking' : m === 'wallet' ? 'Wallet' : m;
}

export default async function CustomerTransactionsPage() {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) redirect('/customer/login');

  let customerId: string | null = null;
  try {
    const payload = await verifyCustomerToken(token);
    customerId = payload.sub;
  } catch { redirect('/customer/login'); }

  // Get this customer's machine IDs
  const { data: machines } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location')
    .eq('customer_id', customerId);

  const machineIds = (machines ?? []).map((m: { id: string }) => m.id);

  if (machineIds.length === 0) {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-8">Transactions</h1>
        <div className="glass rounded-2xl py-16 text-center text-white/30 text-sm">No machines assigned yet.</div>
      </div>
    );
  }

  const { data: raw } = await supabaseAdmin
    .from('coffee_orders')
    .select(`
      id, created_at, drink_type, customization, amount_paise, status, machine_id,
      coffee_payments(razorpay_payment_id, method, status)
    `)
    .in('machine_id', machineIds)
    .order('created_at', { ascending: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = (raw ?? []).map((row: any) => ({
    ...row,
    machineName: (machines ?? []).find((m: { id: string; name: string }) => m.id === row.machine_id)?.name ?? '—',
    machineLocation: (machines ?? []).find((m: { id: string; location: string }) => m.id === row.machine_id)?.location ?? null,
    coffee_payments: Array.isArray(row.coffee_payments) ? row.coffee_payments[0] ?? null : row.coffee_payments ?? null,
  }));

  // Summary stats
  const dispensed   = orders.filter((o: { status: string }) => o.status === 'dispensed').length;
  const failed      = orders.filter((o: { status: string }) => o.status === 'failed').length;
  const totalRevPaise = orders
    .filter((o: { status: string }) => ['dispensed', 'paid', 'dispensing'].includes(o.status))
    .reduce((s: number, o: { amount_paise: number }) => s + o.amount_paise, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Transactions</h1>
        <p className="text-white/40 text-sm mt-1">Last 100 orders across your machines</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Orders', value: String(orders.length) },
          { label: 'Dispensed',    value: String(dispensed) },
          { label: 'Failed',       value: String(failed) },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl px-5 py-4">
            <p className="text-white/40 text-xs uppercase tracking-wider font-medium mb-1">{s.label}</p>
            <p className="text-white text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl px-5 py-4 flex items-center justify-between">
        <p className="text-white/40 text-xs uppercase tracking-wider font-medium">Total Revenue Collected</p>
        <p className="text-coffee-400 text-xl font-bold">₹{(totalRevPaise / 100).toFixed(2)}</p>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">No transactions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">Time</th>
                  <th className="text-left px-5 py-3.5 font-medium">Machine</th>
                  <th className="text-left px-5 py-3.5 font-medium">Drink</th>
                  <th className="text-left px-5 py-3.5 font-medium">Amount</th>
                  <th className="text-left px-5 py-3.5 font-medium">Payment</th>
                  <th className="text-left px-5 py-3.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {orders.map((order: any) => (
                  <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/[.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-white/50 text-xs">
                        <Clock size={11} className="shrink-0" />
                        <span>{new Date(order.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
                        })}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{order.machineName}</p>
                      {order.machineLocation && <p className="text-white/40 text-xs">{order.machineLocation}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{DRINK_LABEL[order.drink_type] ?? 'Coffee'}</span>
                        <div>
                          <p className="text-white capitalize font-medium">{order.drink_type}</p>
                          {order.customization?.strength && (
                            <p className="text-white/40 text-xs capitalize">
                              {order.customization.strength} · {order.customization.milk === false ? 'no milk' : 'with milk'}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-white font-semibold">
                        <IndianRupee size={13} className="text-coffee-400" />
                        {(order.amount_paise / 100).toFixed(0)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white/50 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Smartphone size={11} className="shrink-0" />
                        {fmtMethod(order.coffee_payments?.method)}
                      </div>
                      {order.coffee_payments?.razorpay_payment_id && (
                        <p className="font-mono text-white/25 text-[10px] mt-0.5">
                          {order.coffee_payments.razorpay_payment_id.slice(-10)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
