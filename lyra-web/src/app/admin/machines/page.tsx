import { supabaseAdmin } from '@/lib/supabase-server';
import { MachinesTable } from '@/components/admin/MachinesTable';
import type { CoffeeMachineAdmin } from '@/types';

export const dynamic = 'force-dynamic';

export default async function MachinesPage() {
  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, api_key, last_ping, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold mb-0.5">Machines</h1>
          <p className="text-[#7a7062] text-sm">Manage all vending machines</p>
        </div>
      </div>
      {error ? (
        <p className="text-red-400">Failed to load machines.</p>
      ) : (
        <MachinesTable machines={(data ?? []) as CoffeeMachineAdmin[]} />
      )}
    </div>
  );
}
