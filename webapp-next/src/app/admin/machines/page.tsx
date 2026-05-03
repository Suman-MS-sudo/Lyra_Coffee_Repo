import { supabaseAdmin } from '@/lib/supabase/server';
import MachinesTable from '@/components/admin/MachinesTable';
import type { CoffeeMachine, CoffeeCustomer } from '@/lib/types/database';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Machines' };

export default async function MachinesPage() {
  const [machinesRes, customersRes] = await Promise.all([
    supabaseAdmin
      .from('coffee_machines')
      .select('id, name, location, status, api_key_hash, customer_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('coffee_customers')
      .select('id, name, email, company')
      .eq('is_active', true)
      .order('name'),
  ]);

  if (machinesRes.error) {
    console.error('[MachinesPage] fetch error:', machinesRes.error.message, machinesRes.error.code);
  }

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 lg:mb-8">Machines</h1>
      <MachinesTable
        initialMachines={(machinesRes.data ?? []) as CoffeeMachine[]}
        customers={(customersRes.data ?? []) as Pick<CoffeeCustomer, 'id' | 'name' | 'email' | 'company'>[]}
      />
    </div>
  );
}
