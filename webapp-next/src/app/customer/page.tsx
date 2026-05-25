import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import { MapPin, Wifi, WifiOff, TrendingUp, ShoppingBag, IndianRupee, CpuIcon, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { RevenueAreaChart, DrinkBarChart } from '@/components/charts/DashboardCharts';
import type { RevenueDay, DrinkCount } from '@/components/charts/DashboardCharts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

const ONLINE_MS = 90_000;

function paise(n: number) { return `₹${(n / 100).toFixed(2)}`; }
function paiseRound(n: number) { return `₹${Math.round(n / 100)}`; }

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

const DRINK_LABEL: Record<string, string> = { coffee: 'Coffee', tea: 'Tea', milk: 'Milk' };
const ORDER_STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  paid:       'bg-blue-500/15 text-blue-400 border-blue-500/20',
  dispensing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  dispensed:  'bg-green-500/15 text-green-400 border-green-500/20',
  failed:     'bg-red-500/15 text-red-400 border-red-500/20',
  refunded:   'bg-white/10 text-white/40 border-white/10',
};

export default async function CustomerDashboardPage() {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) redirect('/customer/login');

  let customer: { id: string; name: string } | null = null;
  try {
    const payload = await verifyCustomerToken(token);
    customer = { id: payload.sub, name: payload.name };
  } catch { redirect('/customer/login'); }

  // ── Fetch machines ─────────────────────────────────────────────
  const { data: machines } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, last_seen_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const machineList = (machines ?? []) as {
    id: string; name: string; location: string | null;
    status: string; last_seen_at: string | null;
  }[];
  const machineIds   = machineList.map(m => m.id);
  const now          = Date.now();
  const onlineCount  = machineList.filter(m =>
    m.last_seen_at && now - new Date(m.last_seen_at).getTime() < ONLINE_MS
  ).length;

  if (machineIds.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome, {customer.name} 👋</h1>
          <p className="text-white/40 text-sm mt-1">No machines assigned yet.</p>
        </div>
        <div className="glass rounded-2xl py-16 text-center text-white/30 text-sm">
          No machines assigned to your account yet.
          <br /><span className="text-white/20 text-xs">Contact admin to get your machines set up.</span>
        </div>
      </div>
    );
  }

  // ── Date ranges ────────────────────────────────────────────────
  const since24h = new Date(now - 24 * 3600 * 1000).toISOString();
  const since7d  = new Date(now - 7  * 86_400_000).toISOString();
  const since30d = new Date(now - 30 * 86_400_000).toISOString();

  // ── Parallel data fetch ────────────────────────────────────────
  const [
    orders7dRes,
    payments7dRes,
    orders30dRes,
    recentOrdersRes,
  ] = await Promise.all([
    supabaseAdmin.from('coffee_orders')
      .select('id, created_at, machine_id, status')
      .in('machine_id', machineIds)
      .gte('created_at', since7d),
    supabaseAdmin.from('coffee_payments')
      .select('order_id, amount_paise, created_at')
      .eq('status', 'captured')
      .in('order_id',
        (await supabaseAdmin.from('coffee_orders').select('id')
          .in('machine_id', machineIds).gte('created_at', since7d)
        ).data?.map((o: { id: string }) => o.id) ?? []
      ),
    supabaseAdmin.from('coffee_orders')
      .select('drink_type, machine_id, status, created_at')
      .in('machine_id', machineIds)
      .gte('created_at', since30d),
    supabaseAdmin.from('coffee_orders')
      .select('id, created_at, drink_type, amount_paise, status, machine_id')
      .in('machine_id', machineIds)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const orders7d   = (orders7dRes.data   ?? []) as { id: string; created_at: string; machine_id: string; status: string }[];
  const payments7d = (payments7dRes.data ?? []) as { order_id: string; amount_paise: number; created_at: string }[];
  const orders30d  = (orders30dRes.data  ?? []) as { drink_type: string; machine_id: string; status: string; created_at: string }[];
  const recentOrders = (recentOrdersRes.data ?? []) as {
    id: string; created_at: string; drink_type: string;
    amount_paise: number; status: string; machine_id: string;
  }[];

  // ── Aggregate stats ────────────────────────────────────────────
  const ordersToday   = orders7d.filter(o => now - new Date(o.created_at).getTime() < 86_400_000).length;
  const revenue7d     = payments7d.reduce((s, p) => s + p.amount_paise, 0);
  const revenueToday  = payments7d.filter(p => now - new Date(p.created_at).getTime() < 86_400_000)
    .reduce((s, p) => s + p.amount_paise, 0);

  const successOrders = orders30d.filter(o => o.status === 'dispensed').length;
  const doneOrders    = orders30d.filter(o => ['dispensed', 'failed'].includes(o.status)).length;
  const successRate   = doneOrders > 0 ? Math.round((successOrders / doneOrders) * 100) : 100;

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

  // ── Per-machine stats (today) ──────────────────────────────────
  const machineStats = machineList.map(m => {
    const mOrders  = orders7d.filter(o => o.machine_id === m.id && now - new Date(o.created_at).getTime() < 86_400_000);
    const mPayIds  = new Set(mOrders.map(o => o.id));
    const mRevToday = payments7d.filter(p => mPayIds.has(p.order_id) && now - new Date(p.created_at).getTime() < 86_400_000)
      .reduce((s, p) => s + p.amount_paise, 0);
    const lastMs   = m.last_seen_at ? new Date(m.last_seen_at).getTime() : 0;
    const online   = lastMs > 0 && now - lastMs < ONLINE_MS;
    const diffSec  = lastMs > 0 ? Math.floor((now - lastMs) / 1000) : null;
    const lastSeen = !lastMs ? 'Never' : online ? 'Online' :
      diffSec! < 3600 ? `${Math.floor(diffSec! / 60)}m ago` :
      diffSec! < 86_400 ? `${Math.floor(diffSec! / 3600)}h ago` : 'Long ago';
    return { ...m, online, lastSeen, ordersToday: mOrders.length, revenueToday: mRevToday };
  });

  // ── Machine name lookup for recent orders ──────────────────────
  const machineNameMap = Object.fromEntries(machineList.map(m => [m.id, m.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome, {customer.name} 👋</h1>
        <p className="text-white/40 text-sm mt-1">Here&apos;s your machine overview</p>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="My Machines"   value={String(machineList.length)}  sub={`${onlineCount} online now`}      icon={CpuIcon}      accent="text-blue-400" />
        <StatCard label="Orders Today"  value={String(ordersToday)}         sub="last 24 hours"                    icon={ShoppingBag}  accent="text-coffee-400" />
        <StatCard label="Revenue Today" value={paiseRound(revenueToday)}    sub="captured payments"                icon={IndianRupee}  accent="text-yellow-400" />
        <StatCard label="Revenue 7d"    value={paiseRound(revenue7d)}       sub={`${orders7d.length} orders`}      icon={TrendingUp}   accent="text-green-400" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Active Machines"  value={String(machineList.filter(m => m.status === 'active').length)}  sub="status: active"  icon={CheckCircle2} accent="text-green-400" />
        <StatCard label="Online Now"       value={String(onlineCount)}                                            sub="heartbeat < 90s" icon={Wifi}         accent="text-green-400" />
        <StatCard label="Success Rate"     value={`${successRate}%`}                                              sub="30d dispensed"   icon={CheckCircle2} accent="text-coffee-400" />
        <StatCard label="Failed Orders"    value={String(orders30d.filter(o => o.status === 'failed').length)}    sub="last 30 days"    icon={XCircle}      accent="text-red-400" />
      </div>

      {/* ── Charts row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue & Orders area chart */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white text-sm">Revenue & Orders</h2>
              <p className="text-white/35 text-xs mt-0.5">Last 7 days</p>
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

      {/* ── Machine health table ───────────────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Machine Health</h2>
          <Link href="/customer/machines" className="text-coffee-400 text-xs hover:text-coffee-300 transition-colors">
            Manage →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/35 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Machine</th>
                <th className="text-left px-5 py-3 font-medium">Connectivity</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-right px-5 py-3 font-medium">Orders Today</th>
                <th className="text-right px-5 py-3 font-medium">Revenue Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {machineStats.map(m => (
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
                      {m.online ? (
                        <><span className="relative flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" /><span className="w-1.5 h-1.5 rounded-full bg-green-400" /></span>Online</>
                      ) : (
                        <><WifiOff size={10} />{m.lastSeen}</>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[m.status]}`}>
                      {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-white font-medium">{m.ordersToday}</td>
                  <td className="px-5 py-3.5 text-right text-coffee-400 font-semibold">{paiseRound(m.revenueToday)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent orders ──────────────────────────────────────── */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Recent Orders</h2>
          <Link href="/customer/transactions" className="text-coffee-400 text-xs hover:text-coffee-300 transition-colors">
            View all →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-white/30 text-sm">No orders yet.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentOrders.map(order => (
              <div key={order.id} className="px-5 py-3 flex items-center gap-3">
                <span className="text-xl w-7 shrink-0">{DRINK_LABEL[order.drink_type] ?? 'Coffee'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium capitalize">{order.drink_type}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={10} className="text-white/25" />
                    <p className="text-white/35 text-xs">
                      {new Date(order.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      {' · '}{machineNameMap[order.machine_id] ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-white/70 text-sm font-medium">{paise(order.amount_paise)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ORDER_STATUS_STYLES[order.status] ?? 'bg-white/5 text-white/40 border-white/10'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
