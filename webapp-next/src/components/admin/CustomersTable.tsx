'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusCircle, Trash2, Building2, CheckCircle, XCircle } from 'lucide-react';
import type { CoffeeCustomer } from '@/lib/types/database';

interface Props {
  initialCustomers: CoffeeCustomer[];
}

export default function CustomersTable({ initialCustomers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [customers, setCustomers] = useState<CoffeeCustomer[]>(initialCustomers);

  // Sync with server data after router.refresh()
  useEffect(() => { setCustomers(initialCustomers); }, [initialCustomers]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim(),
          email:    form.email.trim(),
          password: form.password,
          company:  form.company.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      toast.success('Customer created');
      setForm({ name: '', email: '', password: '', company: '' });
      setShowAddForm(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"? Their machines will be unassigned.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete customer');
      } else {
        setCustomers(prev => prev.filter(c => c.id !== id));
        toast.success('Customer deleted');
        router.refresh();
      }
    });
  };

  const handleToggle = async (customer: CoffeeCustomer) => {
    const newActive = !customer.is_active;
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, is_active: newActive } : c));
    const res = await fetch(`/api/admin/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newActive }),
    });
    if (!res.ok) {
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, is_active: customer.is_active } : c));
      toast.error('Failed to update customer');
    } else {
      toast.success(`Customer ${newActive ? 'activated' : 'deactivated'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold hover:bg-coffee-400 active:scale-95 transition-all"
        >
          <PlusCircle size={16} />
          Add Customer
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="glass rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Full name *"
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
          />
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email address *"
            required
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
          />
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Password (min 8 chars) *"
            required
            minLength={8}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
          />
          <input
            value={form.company}
            onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
            placeholder="Company (optional)"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
          />
          <div className="sm:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={adding}
              className="px-5 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold disabled:opacity-60 hover:bg-coffee-400 transition-colors"
            >
              {adding ? 'Creating…' : 'Create Customer'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {customers.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">
            No customers yet. Add your first customer above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">Customer</th>
                  <th className="text-left px-5 py-3.5 font-medium">Company</th>
                  <th className="text-left px-5 py-3.5 font-medium">Status</th>
                  <th className="text-left px-5 py-3.5 font-medium">Last Login</th>
                  <th className="text-right px-5 py-3.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-white font-medium">{c.name}</p>
                      <p className="text-white/40 text-xs">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.company ? (
                        <div className="flex items-center gap-1.5 text-white/50 text-xs">
                          <Building2 size={12} />
                          {c.company}
                        </div>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggle(c)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                          c.is_active
                            ? 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25'
                            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {c.is_active ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        {c.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-white/40 text-xs">
                      {c.last_login_at
                        ? new Date(c.last_login_at).toLocaleString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete customer"
                      >
                        <Trash2 size={15} />
                      </button>
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
