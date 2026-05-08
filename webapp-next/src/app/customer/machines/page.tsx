import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CoffeeMachine } from '@/lib/types/database';
import { getDrinkPrice } from '@/lib/utils/security';
import MachinePricingEditor from '@/components/customer/MachinePricingEditor';
import { ExternalLink, MapPin, Wifi, WifiOff } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Machines' };

const ONLINE_MS = 3 * 60_000; // 3 minutes

const STATUS_STYLES: Record<string, string> = {
  active:      'bg-green-500/15 text-green-400 border-green-500/20',
  inactive:    'bg-white/5 text-white/40 border-white/10',
  maintenance: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

export default async function CustomerMachinesPage() {
  const token = cookies().get('customer_token')?.value;
  if (!token) redirect('/customer/login');

  let customerId: string | null = null;
  try {
    const payload = await verifyCustomerToken(token);
    customerId = payload.sub;
  } catch { redirect('/customer/login'); }

  const { data: machines } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, is_free, price_coffee_paise, price_tea_paise, price_milk_paise, last_seen_at, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const machineList = (machines ?? []) as (CoffeeMachine & { last_seen_at: string | null })[];
  const machineIds  = machineList.map(m => m.id);

  const defaultCoffee = getDrinkPrice('coffee');
  const defaultTea    = getDrinkPrice('tea');
  const defaultMilk   = getDrinkPrice('milk');

  const now      = Date.now();
  const since7d  = new Date(now - 7 * 86_400_000).toISOString();

  // Per-machine 7d stats
  type OrderRow = { machine_id: string; id: string; status: string; created_at: string };
  type PayRow   = { order_id: string; amount_paise: number };

  let orders7d: OrderRow[] = [];
  let payments7d: PayRow[] = [];

  if (machineIds.length > 0) {
    const [ordRes, payRes] = await Promise.all([
      supabaseAdmin.from('coffee_orders')
        .select('id, machine_id, status, created_at')
        .in('machine_id', machineIds)
        .gte('created_at', since7d),
      supabaseAdmin.from('coffee_payments')
        .select('order_id, amount_paise')
        .eq('status', 'captured')
        .in('order_id',
          (await supabaseAdmin.from('coffee_orders').select('id')
            .in('machine_id', machineIds).gte('created_at', since7d)
          ).data?.map((o: { id: string }) => o.id) ?? []
        ),
    ]);
    orders7d   = (ordRes.data  ?? []) as OrderRow[];
    payments7d = (payRes.data  ?? []) as PayRow[];
  }

  return (
    <div>
      <div className="mb-6 lg:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">My Machines</h1>
          <p className="text-white/40 text-sm mt-1">{machineList.length} machine{machineList.length !== 1 ? 's' : ''} assigned</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/35">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            {machineList.filter(m => m.last_seen_at && now - new Date(m.last_seen_at).getTime() < ONLINE_MS).length} online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500/60 inline-block" />
            {machineList.filter(m => m.status === 'active').length} active
          </span>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {machineList.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">
            No machines assigned to your account yet.
            <br /><span className="text-white/20 text-xs">Contact your admin to assign machines.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">Machine</th>
                  <th className="text-left px-5 py-3.5 font-medium">Location</th>
                  <th className="text-left px-5 py-3.5 font-medium">Connectivity</th>
                  <th className="text-left px-5 py-3.5 font-medium">Status</th>
                  <th className="text-left px-5 py-3.5 font-medium">Pricing</th>
                  <th className="text-right px-5 py-3.5 font-medium">Orders 7d</th>
                  <th className="text-right px-5 py-3.5 font-medium">Revenue 7d</th>
                  <th className="text-left px-5 py-3.5 font-medium">Added</th>
                  <th className="px-5 py-3.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {machineList.map(machine => {
                  const lastMs   = machine.last_seen_at ? new Date(machine.last_seen_at).getTime() : 0;
                  const online   = lastMs > 0 && now - lastMs < ONLINE_MS;
                  const diffSec  = lastMs > 0 ? Math.floor((now - lastMs) / 1000) : null;
                  const lastSeen = !lastMs ? 'Never' :
                    online ? 'Online' :
                    diffSec! < 60 ? `${diffSec}s ago` :
                    diffSec! < 3600 ? `${Math.floor(diffSec! / 60)}m ago` :
                    diffSec! < 86_400 ? `${Math.floor(diffSec! / 3600)}h ago` : 'Long ago';

                  const mOrders  = orders7d.filter(o => o.machine_id === machine.id);
                  const paidIds  = new Set(mOrders.map(o => o.id));
                  const mRev     = payments7d.filter(p => paidIds.has(p.order_id)).reduce((s, p) => s + p.amount_paise, 0);

                  return (
                    <tr key={machine.id} className="hover:bg-white/[.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-white font-medium">{machine.name}</p>
                        <p className="text-white/20 text-xs font-mono mt-0.5">{machine.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {machine.location ? (
                          <div className="flex items-center gap-1.5 text-white/50">
                            <MapPin size={12} /><span>{machine.location}</span>
                          </div>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                          online
                            ? 'bg-green-500/12 text-green-400 border-green-500/20'
                            : 'bg-white/5 text-white/35 border-white/10'
                        }`}>
                          {online ? (
                            <><span className="relative flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-60" /><span className="w-1.5 h-1.5 rounded-full bg-green-400" /></span><Wifi size={10} />Online</>
                          ) : (
                            <><WifiOff size={10} />{lastSeen}</>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_STYLES[machine.status]}`}>
                          {machine.status.charAt(0).toUpperCase() + machine.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <MachinePricingEditor
                          machineId={machine.id}
                          isFree={machine.is_free}
                          priceCoffeePaise={machine.price_coffee_paise}
                          priceTeaPaise={machine.price_tea_paise}
                          priceMilkPaise={machine.price_milk_paise}
                          defaultCoffee={defaultCoffee}
                          defaultTea={defaultTea}
                          defaultMilk={defaultMilk}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right text-white font-medium">{mOrders.length}</td>
                      <td className="px-5 py-3.5 text-right text-coffee-400 font-semibold">
                        ₹{Math.round(mRev / 100)}
                      </td>
                      <td className="px-5 py-3.5 text-white/40 text-xs">
                        {new Date(machine.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <a
                          href={`/?machine=${machine.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open machine page"
                          className="p-2 rounded-xl text-white/30 hover:text-coffee-400 hover:bg-coffee-400/10 transition-colors inline-flex"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
