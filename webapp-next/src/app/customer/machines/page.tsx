import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CoffeeMachine } from '@/lib/types/database';
import { getDrinkPrice } from '@/lib/utils/security';
import MachinePricingEditor from '@/components/customer/MachinePricingEditor';
import { MapPin } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Machines' };

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

export default async function CustomerMachinesPage() {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) redirect('/customer/login');

  let customerId: string | null = null;
  try {
    const payload = await verifyCustomerToken(token);
    customerId = payload.sub;
  } catch {
    redirect('/customer/login');
  }

  const { data: machines } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, is_free, price_coffee_paise, price_tea_paise, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const machineList = (machines ?? []) as CoffeeMachine[];
  const defaultCoffee = getDrinkPrice('coffee');
  const defaultTea    = getDrinkPrice('tea');

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 lg:mb-8">My Machines</h1>

      <div className="glass rounded-2xl overflow-hidden">
        {machineList.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">
            No machines assigned to your account yet.
            <br />
            <span className="text-white/20 text-xs">Contact your admin to assign machines.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">Machine</th>
                  <th className="text-left px-5 py-3.5 font-medium">Location</th>
                  <th className="text-left px-5 py-3.5 font-medium">Status</th>
                  <th className="text-left px-5 py-3.5 font-medium">Pricing</th>
                  <th className="text-left px-5 py-3.5 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {machineList.map(machine => (
                  <tr key={machine.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{machine.name}</p>
                      <p className="text-white/20 text-xs font-mono mt-0.5">{machine.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {machine.location ? (
                        <div className="flex items-center gap-1.5 text-white/50">
                          <MapPin size={12} />
                          <span>{machine.location}</span>
                        </div>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[machine.status]}`}>
                        {STATUS_LABEL[machine.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <MachinePricingEditor
                        machineId={machine.id}
                        isFree={machine.is_free}
                        priceCoffeePaise={machine.price_coffee_paise}
                        priceTeaPaise={machine.price_tea_paise}
                        defaultCoffee={defaultCoffee}
                        defaultTea={defaultTea}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-white/40">
                      {new Date(machine.created_at).toLocaleDateString()}
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
