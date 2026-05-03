import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import DashboardStats from '@/components/admin/DashboardStats';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // Verify session (middleware handles redirect, but we need the payload)
  const token = (await cookies()).get('admin_token')?.value;
  if (!token) redirect('/admin/login');

  let admin: { name: string; email: string } | null = null;
  try {
    const payload = await verifyAdminToken(token);
    admin = { name: payload.name, email: payload.email };
  } catch {
    redirect('/admin/login');
  }

  // Fetch dashboard stats
  const [machinesRes, ordersRes, revenueRes] = await Promise.all([
    supabaseAdmin
      .from('coffee_machines')
      .select('status', { count: 'exact' }),
    supabaseAdmin
      .from('coffee_orders')
      .select('status', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    supabaseAdmin
      .from('coffee_payments')
      .select('amount_paise')
      .eq('status', 'captured')
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);

  const totalMachines  = machinesRes.count ?? 0;
  const activeMachines = ((machinesRes.data ?? []) as { status: string }[]).filter(m => m.status === 'active').length;
  const ordersToday    = ordersRes.count ?? 0;
  const revenueToday   = ((revenueRes.data ?? []) as { amount_paise: number | null }[]).reduce((s, p) => s + (p.amount_paise ?? 0), 0);

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Good day, {admin.name} 👋
        </h1>
        <p className="text-white/40 text-sm mt-1">Here&apos;s your machine overview</p>
      </div>
      <DashboardStats
        totalMachines={totalMachines}
        activeMachines={activeMachines}
        ordersToday={ordersToday}
        revenueToday={revenueToday}
      />
    </div>
  );
}
