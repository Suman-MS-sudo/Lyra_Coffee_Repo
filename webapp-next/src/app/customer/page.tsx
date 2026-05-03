import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CoffeeMachine } from '@/lib/types/database';
import { MapPin, Activity, ShoppingBag, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

const STATUS_LABEL: Record<string, string> = {
  active:      'Active',
  inactive:    'Inactive',
  maintenance: 'Maintenance',
};

const STATUS_STYLES: Record<string, string> = {
  active:      'bg-green-500/15 text-green-400 border border-green-500/20',
  inactive:    'bg-white/5 text-white/40 border border-white/10',
  maintenance: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
};

export default async function CustomerDashboardPage() {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) redirect('/customer/login');

  let customer: { id: string; name: string; email: string } | null = null;
  try {
    const payload = await verifyCustomerToken(token);
    customer = { id: payload.sub, name: payload.name, email: payload.email };
  } catch {
    redirect('/customer/login');
  }

  // Fetch this customer's machines
  const { data: machines } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const machineList = (machines ?? []) as Pick<CoffeeMachine, 'id' | 'name' | 'location' | 'status' | 'created_at'>[];
  const activeMachines = machineList.filter(m => m.status === 'active').length;

  // Fetch recent orders from their machines
  const machineIds = machineList.map(m => m.id);
  let ordersToday = 0;
  let revenueToday = 0;

  if (machineIds.length > 0) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [ordersRes, revenueRes] = await Promise.all([
      supabaseAdmin
        .from('coffee_orders')
        .select('id', { count: 'exact' })
        .in('machine_id', machineIds)
        .gte('created_at', since),
      supabaseAdmin
        .from('coffee_payments')
        .select('amount_paise')
        .in('order_id',
          (await supabaseAdmin
            .from('coffee_orders')
            .select('id')
            .in('machine_id', machineIds)
            .gte('created_at', since)
          ).data?.map(o => o.id) ?? []
        )
        .eq('status', 'captured'),
    ]);
    ordersToday  = ordersRes.count ?? 0;
    revenueToday = ((revenueRes.data ?? []) as { amount_paise: number }[]).reduce(
      (s, p) => s + p.amount_paise, 0
    );
  }

  const stats = [
    { label: 'My Machines',    value: machineList.length, icon: Activity,    color: 'text-blue-400' },
    { label: 'Active Now',     value: activeMachines,     icon: TrendingUp,  color: 'text-green-400' },
    { label: 'Orders Today',   value: ordersToday,        icon: ShoppingBag, color: 'text-coffee-400' },
    { label: 'Revenue Today',  value: `₹${(revenueToday / 100).toFixed(2)}`, icon: TrendingUp, color: 'text-yellow-400' },
  ];

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Welcome, {customer.name} 👋
        </h1>
        <p className="text-white/40 text-sm mt-1">Here&apos;s an overview of your machines</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</p>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Machines */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Your Machines</h2>
          <Link
            href="/customer/machines"
            className="text-coffee-400 text-xs hover:text-coffee-300 transition-colors"
          >
            View all →
          </Link>
        </div>
        {machineList.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">
            No machines assigned to your account yet.
            <br />
            <span className="text-white/20 text-xs">Contact admin to get your machines set up.</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {machineList.slice(0, 5).map(machine => (
              <div key={machine.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{machine.name}</p>
                  {machine.location && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-white/30 flex-shrink-0" />
                      <p className="text-white/40 text-xs truncate">{machine.location}</p>
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[machine.status]}`}>
                  {STATUS_LABEL[machine.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
