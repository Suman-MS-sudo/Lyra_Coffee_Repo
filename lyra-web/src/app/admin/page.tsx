import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // Fetch summary stats
  const [machinesRes, ordersRes, revenueRes] = await Promise.all([
    supabaseAdmin.from('coffee_machines').select('id, status', { count: 'exact' }),
    supabaseAdmin.from('coffee_orders').select('id, status, amount_paise', { count: 'exact' }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    supabaseAdmin.from('coffee_payments').select('id').eq('status', 'captured'),
  ]);

  const totalMachines = machinesRes.count ?? 0;
  const activeMachines = (machinesRes.data ?? []).filter(m => m.status === 'active').length;
  const ordersToday = ordersRes.count ?? 0;
  const revenueToday = (ordersRes.data ?? [])
    .filter(o => o.status === 'dispensed')
    .reduce((sum, o) => sum + (o.amount_paise ?? 0), 0);

  const stats = [
    { label: 'Total Machines',  value: totalMachines.toString(),       sub: `${activeMachines} active` },
    { label: 'Orders Today',    value: ordersToday.toString(),          sub: 'last 24 hours' },
    { label: 'Revenue Today',   value: `₹${(revenueToday / 100).toFixed(0)}`, sub: 'dispensed orders' },
    { label: 'Total Payments',  value: (revenueRes.data?.length ?? 0).toString(), sub: 'all time' },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold mb-1">Dashboard</h1>
      <p className="text-[#7a7062] text-sm mb-6">Welcome back, Admin</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4">
            <p className="text-xs text-[#7a7062] uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-[#f0ece4]">{s.value}</p>
            <p className="text-xs text-[#7a7062] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5">
        <h2 className="font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: '/admin/machines', label: '🖥️  Manage Machines' },
            { href: '/admin/orders',   label: '📋  View Orders' },
            { href: '/admin/machines', label: '➕  Add Machine' },
          ].map(l => (
            <a
              key={l.href + l.label}
              href={l.href}
              className="px-4 py-3 rounded-xl border border-[#2e2e2e] text-sm hover:border-[#c8861a] hover:bg-[#c8861a]/5 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
