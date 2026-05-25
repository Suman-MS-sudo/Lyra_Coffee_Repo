import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CpuIcon, Users, ShoppingBag, IndianRupee, TrendingUp, Wifi, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { RevenueAreaChart, DrinkBarChart, PaymentPieChart } from '@/components/charts/DashboardCharts';
import type { RevenueDay, DrinkCount, MethodCount } from '@/components/charts/DashboardCharts';

export const dynamic = 'force-dynamic';

const ONLINE_MS = 90_000;

function StatCard({ label, value, sub, icon: Icon, accent = 'text-coffee-400' }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  accent?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-white/40 text-xs uppercase tracking-wider font-medium mb-1.5">{label}</p>
          <p className="text-white text-2xl font-bold truncate">{value}</p>
          {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-white/5 shrink-0 ${accent}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active:      'bg-green-500/15 text-green-400 border-green-500/20',
  inactive:    'bg-white/5 text-white/40 border-white/10',
  maintenance: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

export default async function AdminDashboardPage() {
  const token = (await cookies()).get('admin_token')?.value;
  if (!token) redirect('/admin/login');

  let admin: { name: string } | null = null;
  try {
    const payload = await verifyAdminToken(token);
    admin = { name: payload.name };
  } catch { redirect('/admin/login'); }

  const now     = Date.now();
  const since24h = new Date(now - 86_400_000).toISOString();
  const since7d  = new Date(now - 7  * 86_400_000).toISOString();
  const since30d = new Date(now - 30 * 86_400_000).toISOString();

  // ── Parallel fetches ────────────────────────────────────────────
  const [
    machinesRes,
    customersRes,
    orders7dRes,
    orders30dRes,
    payments7dRes,
    payments30dRes,
    recentOrdersRes,
  ] = await Promise.all([
    supabaseAdmin.from('coffee_machines')
      .select('id, name, location, status, last_seen_at, customer_id'),
    supabaseAdmin.from('coffee_customers')
      .select('id, name', { count: 'exact' })
      .eq('is_active', true),
    supabaseAdmin.from('coffee_orders')
      .select('id, created_at, machine_id, status, drink_type, amount_paise'),
    supabaseAdmin.from('coffee_orders')
      .select('id, drink_type, status, machine_id, created_at, amount_paise')
      .gte('created_at', since30d),
    supabaseAdmin.from('coffee_payments')
      .select('order_id, amount_paise, method, created_at')
      .eq('status', 'captured')
      .gte('created_at', since7d),
    supabaseAdmin.from('coffee_payments')
      .select('order_id, amount_paise, method, created_at')
      .eq('status', 'captured')
      .gte('created_at', since30d),
    supabaseAdmin.from('coffee_orders')
      .select(`id, created_at, drink_type, amount_paise, status, machine_id, coffee_machines(name, location)`)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  type Machine    = { id: string; name: string; location: string | null; status: string; last_seen_at: string | null; customer_id: string | null };
  type Order7d    = { id: string; created_at: string; machine_id: string; status: string; drink_type: string; amount_paise: number };
  type Order30d   = { id: string; drink_type: string; status: string; machine_id: string; created_at: string; amount_paise: number };
  type Payment    = { order_id: string; amount_paise: number; method: string | null; created_at: string };

  const allMachines  = (machinesRes.data  ?? []) as Machine[];
  const orders7d     = (orders7dRes.data  ?? []) as Order7d[];
  const orders30d    = (orders30dRes.data ?? []) as Order30d[];
  const payments7d   = (payments7dRes.data  ?? []) as Payment[];
  const payments30d  = (payments30dRes.data ?? []) as Payment[];
  const totalCustomers = customersRes.count ?? 0;

  // ── Aggregations ────────────────────────────────────────────────
  const totalMachines  = allMachines.length;
  const activeMachines = allMachines.filter(m => m.status === 'active').length;
  const onlineNow      = allMachines.filter(m =>
    m.last_seen_at && now - new Date(m.last_seen_at).getTime() < ONLINE_MS
  ).length;

  const ordersToday   = orders7d.filter(o => now - new Date(o.created_at).getTime() < 86_400_000).length;
  const revenueToday  = payments7d.filter(p => now - new Date(p.created_at).getTime() < 86_400_000)
    .reduce((s, p) => s + p.amount_paise, 0);
  const revenue7d     = payments7d.reduce((s, p) => s + p.amount_paise, 0);
  const revenue30d    = payments30d.reduce((s, p) => s + p.amount_paise, 0);

  const paidOrders30d  = payments30d.length;
  const avgOrderPaise  = paidOrders30d > 0 ? Math.round(revenue30d / paidOrders30d) : 0;

  const doneOrders30d  = orders30d.filter(o => ['dispensed', 'failed'].includes(o.status)).length;
  const dispOrders30d  = orders30d.filter(o => o.status === 'dispensed').length;
  const successRate    = doneOrders30d > 0 ? Math.round((dispOrders30d / doneOrders30d) * 100) : 100;
  const failedCount30d = orders30d.filter(o => o.status === 'failed').length;

  // ── 7-day revenue chart ────────────────────────────────────────
  const revenueDays: RevenueDay[] = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now - (6 - i) * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(dayStart.getTime() + 86_400_000);
    const dayOrds  = orders7d.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
    const paidIds  = new Set(dayOrds.map(o => o.id));
    const dayRev   = payments7d.filter(p => paidIds.has(p.order_id)).reduce((s, p) => s + p.amount_paise, 0);
    return {
      date:    dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: Math.round(dayRev / 100),
      orders:  dayOrds.length,
    };
  });

  // ── Drink breakdown (30d) ──────────────────────────────────────
  const drinkMap = orders30d.reduce<Record<string, number>>((acc, o) => {
    acc[o.drink_type] = (acc[o.drink_type] ?? 0) + 1;
    return acc;
  }, {});
  const drinkBreakdown: DrinkCount[] = Object.entries(drinkMap)
    .map(([drink, count]) => ({ drink, count }))
    .sort((a, b) => b.count - a.count);

  // ── Payment methods (30d) ──────────────────────────────────────
  const methodMap = payments30d.reduce<Record<string, number>>((acc, p) => {
    const k = p.method ?? 'unknown';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const paymentMethods: MethodCount[] = Object.entries(methodMap)
    .map(([method, count]) => ({ method, count }))
    .sort((a, b) => b.count - a.count);

  // ── Top machines by revenue (30d) ─────────────────────────────
  const machineRevMap = payments30d.reduce<Record<string, number>>((acc, p) => {
    const order = orders30d.find(o => o.id === p.order_id);
    if (order) acc[order.machine_id] = (acc[order.machine_id] ?? 0) + p.amount_paise;
    return acc;
  }, {});
  const machineOrdMap = orders30d.reduce<Record<string, number>>((acc, o) => {
    acc[o.machine_id] = (acc[o.machine_id] ?? 0) + 1;
    return acc;
  }, {});

  const topMachines = allMachines
    .map(m => ({
      ...m,
      revenue30d: machineRevMap[m.id] ?? 0,
      orders30d:  machineOrdMap[m.id] ?? 0,
      online: m.last_seen_at && now - new Date(m.last_seen_at).getTime() < ONLINE_MS,
    }))
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, 8);

  // ── Recent orders ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentOrders = ((recentOrdersRes.data ?? []) as any[]).map(row => ({
    ...row,
    coffee_machines: Array.isArray(row.coffee_machines) ? (row.coffee_machines[0] ?? null) : (row.coffee_machines ?? null),
  }));

  const DRINK_LABEL: Record<string, string> = { coffee: 'Coffee', tea: 'Tea', milk: 'Milk' };
  const ORDER_STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    paid: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    dispensing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    dispensed: 'bg-green-500/15 text-green-400 border-green-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
    refunded: 'bg-white/10 text-white/40 border-white/10',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Good day, {admin.name} 👋</h1>
        <p className="text-white/40 text-sm mt-1">Platform overview · live data</p>
      </div>

      {/* ── Row 1: Machine + Order stats ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Machines"  value={String(totalMachines)}  sub={`${activeMachines} active`}       icon={CpuIcon}      accent="text-blue-400" />
        <StatCard label="Online Now"      value={String(onlineNow)}      sub="heartbeat < 90s"                  icon={Wifi}         accent="text-green-400" />
        <StatCard label="Customers"       value={String(totalCustomers)} sub="active accounts"                  icon={Users}        accent="text-purple-400" />
        <StatCard label="Orders Today"    value={String(ordersToday)}    sub="last 24 hours"                    icon={ShoppingBag}  accent="text-coffee-400" />
      </div>

      {/* ── Row 2: Revenue + Quality stats ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Revenue Today"  value={`₹${Math.round(revenueToday / 100)}`}  sub="captured payments"      icon={IndianRupee}  accent="text-yellow-400" />
        <StatCard label="Revenue 7d"     value={`₹${Math.round(revenue7d / 100)}`}     sub={`${orders7d.length} orders`} icon={TrendingUp}   accent="text-green-400" />
        <StatCard label="Success Rate"   value={`${successRate}%`}                     sub="30d dispensed"          icon={CheckCircle2} accent="text-coffee-400" />
        <StatCard label="Avg Order"      value={`₹${Math.round(avgOrderPaise / 100)}`} sub="30d captured avg"       icon={IndianRupee}  accent="text-coffee-400" />
      </div>

      {/* ── Charts row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue + Orders area */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white text-sm">Revenue &amp; Orders</h2>
              <p className="text-white/35 text-xs mt-0.5">Last 7 days · all machines</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-white/40">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#D4A24A] inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#60a5fa] inline-block" />Orders</span>
            </div>
          </div>
          <RevenueAreaChart data={revenueDays} />
        </div>

        {/* Drink breakdown */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-white text-sm mb-1">Drink Breakdown</h2>
          <p className="text-white/35 text-xs mb-4">Last 30 days</p>
          {drinkBreakdown.length > 0 ? (
            <DrinkBarChart data={drinkBreakdown} />
          ) : (
            <div className="h-40 flex items-center justify-center text-white/20 text-xs">No orders yet</div>
          )}
        </div>
      </div>

      {/* ── Second charts row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment methods */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-white text-sm mb-1">Payment Methods</h2>
          <p className="text-white/35 text-xs mb-2">Last 30 days</p>
          {paymentMethods.length > 0 ? (
            <PaymentPieChart data={paymentMethods} />
          ) : (
            <div className="h-44 flex items-center justify-center text-white/20 text-xs">No payments yet</div>
          )}
        </div>

        {/* Quality stats */}
        <div className="glass rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-white text-sm mb-1">Quality · 30 days</h2>
          {[
            { label: 'Dispensed',    value: dispOrders30d,  color: 'bg-green-400' },
            { label: 'Failed',       value: failedCount30d, color: 'bg-red-400' },
            { label: 'Refunded',     value: orders30d.filter(o => o.status === 'refunded').length, color: 'bg-white/30' },
            { label: 'Pending/Paid', value: orders30d.filter(o => ['pending','paid','dispensing'].includes(o.status)).length, color: 'bg-blue-400' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${row.color}`} />
                <span className="text-white/50 text-sm">{row.label}</span>
              </div>
              <span className="text-white font-semibold text-sm">{row.value}</span>
            </div>
          ))}
          <div className="mt-auto pt-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-white/35 text-xs">Success rate</span>
              <span className="text-coffee-400 font-bold">{successRate}%</span>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-white text-sm mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {recentOrders.slice(0, 6).map((o: { id: string; created_at: string; drink_type: string; amount_paise: number; status: string; coffee_machines: { name: string } | null }) => (
              <div key={o.id} className="flex items-center gap-2.5">
                <span className="text-lg shrink-0">{DRINK_LABEL[o.drink_type] ?? 'Coffee'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{o.coffee_machines?.name ?? '—'}</p>
                  <p className="text-white/30 text-[10px]">
                    {new Date(o.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-coffee-400 text-xs font-semibold">₹{Math.round(o.amount_paise / 100)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ORDER_STATUS_STYLES[o.status] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Machine utilisation table ────────────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="font-semibold text-white text-sm">Machine Utilisation</h2>
          <p className="text-white/35 text-xs mt-0.5">All machines · last 30 days · sorted by revenue</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Machine</th>
                <th className="text-left px-5 py-3 font-medium">Connectivity</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Orders 30d</th>
                <th className="text-right px-5 py-3 font-medium">Revenue 30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {topMachines.map(m => {
                const lastMs  = m.last_seen_at ? new Date(m.last_seen_at).getTime() : 0;
                const diffSec = lastMs > 0 ? Math.floor((now - lastMs) / 1000) : null;
                const lastSeen = !lastMs ? 'Never' :
                  m.online ? 'Online' :
                  diffSec! < 3600 ? `${Math.floor(diffSec! / 60)}m ago` :
                  diffSec! < 86_400 ? `${Math.floor(diffSec! / 3600)}h ago` : 'Long ago';
                return (
                  <tr key={m.id} className="hover:bg-white/[.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{m.name}</p>
                      {m.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={10} className="text-white/30" />
                          <p className="text-white/35 text-xs">{m.location}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        m.online
                          ? 'bg-green-500/12 text-green-400 border-green-500/20'
                          : 'bg-white/5 text-white/35 border-white/10'
                      }`}>
                        {m.online
                          ? <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Online</>
                          : lastSeen
                        }
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[m.status]}`}>
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-white font-medium">{m.orders30d}</td>
                    <td className="px-5 py-3.5 text-right text-coffee-400 font-semibold">
                      ₹{Math.round(m.revenue30d / 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
