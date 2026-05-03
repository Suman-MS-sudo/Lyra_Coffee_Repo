'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusCircle, MapPin, Clock, Wifi, WifiOff, Power, Trash2, UserCheck } from 'lucide-react';
import type { CoffeeMachine, MachineStatus, CoffeeCustomer } from '@/lib/types/database';

interface Props {
  initialMachines: CoffeeMachine[];
  customers: Pick<CoffeeCustomer, 'id' | 'name' | 'email' | 'company'>[];
}

const STATUS_STYLES: Record<MachineStatus, string> = {
  active:      'bg-green-500/15 text-green-400 border-green-500/20',
  inactive:    'bg-white/5 text-white/40 border-white/10',
  maintenance: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

export default function MachinesTable({ initialMachines, customers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Local optimistic copy so status changes feel instant
  const [machines, setMachines] = useState<CoffeeMachine[]>(initialMachines);

  // Sync with server data after router.refresh()
  useEffect(() => { setMachines(initialMachines); }, [initialMachines]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/admin/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), location: newLocation.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      toast.success('Machine added');
      setNewName(''); setNewLocation(''); setShowAddForm(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add machine');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (machine: CoffeeMachine) => {
    const newStatus: MachineStatus = machine.status === 'active' ? 'inactive' : 'active';
    // Optimistic update
    setMachines(prev => prev.map(m => m.id === machine.id ? { ...m, status: newStatus } : m));
    startTransition(async () => {
      const res = await fetch(`/api/admin/machines/${machine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Revert
        setMachines(prev => prev.map(m => m.id === machine.id ? { ...m, status: machine.status } : m));
        toast.error('Failed to update machine');
      } else {
        toast.success(`Machine ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
      }
      router.refresh();
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete machine "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/machines/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete machine');
      } else {
        toast.success('Machine deleted');
        router.refresh();
      }
    });
  };

  const handleAssignCustomer = async (machine: CoffeeMachine, customerId: string | null) => {
    setMachines(prev => prev.map(m => m.id === machine.id ? { ...m, customer_id: customerId } : m));
    startTransition(async () => {
      const res = await fetch(`/api/admin/machines/${machine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (!res.ok) {
        setMachines(prev => prev.map(m => m.id === machine.id ? { ...m, customer_id: machine.customer_id } : m));
        toast.error('Failed to assign customer');
      } else {
        toast.success(customerId ? 'Customer assigned' : 'Customer unassigned');
        router.refresh();
      }
    });
  };

  const isOnline = (m: CoffeeMachine) => false; // requires last_ping — add when schema updated

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold hover:bg-coffee-400 active:scale-95 transition-all"
        >
          <PlusCircle size={16} />
          Add Machine
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="glass rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Machine name *"
            required
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
          />
          <input
            value={newLocation}
            onChange={e => setNewLocation(e.target.value)}
            placeholder="Location (optional)"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-5 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold disabled:opacity-60 hover:bg-coffee-400 transition-colors"
          >
            {adding ? 'Adding…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {machines.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-sm">
            No machines yet. Add your first machine above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3.5 font-medium">Machine</th>
                  <th className="text-left px-5 py-3.5 font-medium">Location</th>
                  <th className="text-left px-5 py-3.5 font-medium">Customer</th>
                  <th className="text-left px-5 py-3.5 font-medium">Status</th>
                  <th className="text-left px-5 py-3.5 font-medium">Created</th>
                  <th className="text-right px-5 py-3.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {machines.map(m => (
                  <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[.02] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {isOnline(m) ? (
                          <Wifi size={14} className="text-green-400 shrink-0" />
                        ) : (
                          <WifiOff size={14} className="text-white/20 shrink-0" />
                        )}
                        <span className="font-medium text-white">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white/50">
                      {m.location ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={12} className="shrink-0" />
                          {m.location}
                        </span>
                      ) : '—'}
                    </td>
                    {/* Customer assignment */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={12} className="text-white/20 shrink-0" />
                        <select
                          value={m.customer_id ?? ''}
                          onChange={e => handleAssignCustomer(m, e.target.value || null)}
                          disabled={isPending}
                          className="bg-transparent text-xs text-white/60 border-0 outline-none cursor-pointer hover:text-white transition-colors disabled:opacity-40 max-w-[130px] truncate"
                        >
                          <option value="">Unassigned</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[m.status]}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-white/40 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Clock size={11} className="shrink-0" />
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(m)}
                          disabled={isPending}
                          title={m.status === 'active' ? 'Disable' : 'Enable'}
                          className={`p-2 rounded-xl transition-colors disabled:opacity-40
                            ${m.status === 'active'
                              ? 'text-green-400 hover:bg-green-400/10'
                              : 'text-white/30 hover:bg-white/5 hover:text-white/60'
                            }`}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          disabled={isPending}
                          title="Delete machine"
                          className="p-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
