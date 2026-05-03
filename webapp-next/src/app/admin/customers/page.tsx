import { supabaseAdmin } from '@/lib/supabase/server';
import CustomersTable from '@/components/admin/CustomersTable';
import type { CoffeeCustomer } from '@/lib/types/database';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers' };

export default async function CustomersPage() {
  const { data: customers } = await supabaseAdmin
    .from('coffee_customers')
    .select('id, name, email, company, is_active, last_login_at, created_at')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 lg:mb-8">Customers</h1>
      <CustomersTable initialCustomers={(customers ?? []) as CoffeeCustomer[]} />
    </div>
  );
}
