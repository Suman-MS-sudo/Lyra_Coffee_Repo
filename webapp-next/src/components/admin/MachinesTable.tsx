'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusCircle, MapPin, Clock, Wifi, WifiOff, Power, Trash2, UserCheck, X, Copy, Check, ExternalLink } from 'lucide-react';
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

interface CreatedMachine {
  id:       string;
  name:     string;
  url:      string;
  api_key?: string;
  mac_id?:  string | null;
}

const rupeesToPaise = (v: string): number | null => {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

export default function MachinesTable({ initialMachines, customers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Local optimistic copy so status changes feel instant
  const [machines, setMachines] = useState<CoffeeMachine[]>(initialMachines);

  // Sync with server data after router.refresh()
  useEffect(() => { setMachines(initialMachines); }, [initialMachines]);

  // ── Add form state ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName]         = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newMacId, setNewMacId]       = useState('');
  const [newIsFree, setNewIsFree]     = useState(false);
  const [newCoffeeRupees, setNewCoffeeRupees] = useState('');
  const [newTeaRupees, setNewTeaRupees]       = useState('');
  const [newMilkRupees, setNewMilkRupees]     = useState('');
  const [newStatus, setNewStatus]     = useState<MachineStatus>('active');

  // ── Post-create dialog ──
  const [created, setCreated] = useState<CreatedMachine | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const resetForm = () => {
    setNewName(''); setNewLocation(''); setNewCustomer('');
    setNewMacId(''); setNewIsFree(false);
    setNewCoffeeRupees(''); setNewTeaRupees(''); setNewMilkRupees('');
    setNewStatus('active');
  };

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast.error('Copy failed — copy manually');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const body: Record<string, unknown> = {
      name:        newName.trim(),
      location:    newLocation.trim() || null,
      status:      newStatus,
      customer_id: newCustomer || null,
      is_free:     newIsFree,
      mac_id:      newMacId.trim() || null,
    };
    if (!newIsFree) {
      body.price_coffee_paise = rupeesToPaise(newCoffeeRupees);
      body.price_tea_paise    = rupeesToPaise(newTeaRupees);
      body.price_milk_paise   = rupeesToPaise(newMilkRupees);
    }

    setAdding(true);
    try {
      const res = await fetch('/api/admin/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(json?.error ?? 'Failed to add machine');

      const id    = json.id as string;
      const url   = `${window.location.origin}/?machine=${id}`;

      setCreated({
        id,
        name:    json.name,
        url,
        api_key: json.api_key,
        mac_id:  json.mac_id ?? null,
      });
      toast.success('Machine created');
      resetForm();
      setShowAddForm(false);
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
      if (res.ok) {
        toast.success('Machine deleted');
        router.refresh();
        return;
      }

      const payload = await res.json().catch(() => ({} as { error?: string }));
      const message = payload?.error ?? 'Failed to delete machine';

      // 409 = has linked orders/dispense; offer force delete
      if (res.status === 409) {
        if (!confirm(
          `${message}\n\nForce delete "${name}" and ALL its orders, payments, and dispense history?`,
        )) return;

        const force = await fetch(
          `/api/admin/machines/${id}?force=true`,
          { method: 'DELETE' },
        );
        if (force.ok) {
          toast.success('Machine and history deleted');
          router.refresh();
        } else {
          const f = await force.json().catch(() => ({} as { error?: string }));
          toast.error(f?.error ?? 'Force delete failed');
        }
        return;
      }

      toast.error(message);
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

  const isOnline = (m: CoffeeMachine) => {
    if (!m.last_seen_at) return false;
    return Date.now() - new Date(m.last_seen_at).getTime() < 5 * 60 * 1000;
  };

  // ── Payment inline edit state ──
  const [editPaymentId, setEditPaymentId]       = useState<string | null>(null);
  const [editIsFree, setEditIsFree]             = useState(false);
  const [editCoffeeRupees, setEditCoffeeRupees] = useState('');
  const [editTeaRupees, setEditTeaRupees]       = useState('');
  const [editMilkRupees, setEditMilkRupees]     = useState('');

  const openPaymentEdit = (m: CoffeeMachine) => {
    setEditPaymentId(m.id);
    setEditIsFree(m.is_free);
    setEditCoffeeRupees(m.price_coffee_paise != null ? String(m.price_coffee_paise / 100) : '');
    setEditTeaRupees(m.price_tea_paise   != null ? String(m.price_tea_paise   / 100) : '');
    setEditMilkRupees(m.price_milk_paise != null ? String(m.price_milk_paise  / 100) : '');
  };

  const savePayment = async (m: CoffeeMachine) => {
    const body: Record<string, unknown> = { is_free: editIsFree };
    if (!editIsFree) {
      body.price_coffee_paise = rupeesToPaise(editCoffeeRupees);
      body.price_tea_paise    = rupeesToPaise(editTeaRupees);
      body.price_milk_paise   = rupeesToPaise(editMilkRupees);
    }
    setMachines(prev => prev.map(x => x.id === m.id ? {
      ...x, is_free: editIsFree,
      price_coffee_paise: editIsFree ? null : rupeesToPaise(editCoffeeRupees),
      price_tea_paise:    editIsFree ? null : rupeesToPaise(editTeaRupees),
      price_milk_paise:   editIsFree ? null : rupeesToPaise(editMilkRupees),
    } : x));
    setEditPaymentId(null);
    const res = await fetch(`/api/admin/machines/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error('Failed to update payment'); router.refresh(); }
    else          { toast.success('Payment settings updated'); router.refresh(); }
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
          Add Machine
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="glass rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-white/40 mb-1.5 block">Machine name *</span>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Lobby Brewer"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-white/40 mb-1.5 block">Location</span>
              <input
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                placeholder="e.g. Bengaluru – Floor 3"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-white/40 mb-1.5 block">Customer</span>
              <select
                value={newCustomer}
                onChange={e => setNewCustomer(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-coffee-500/60 transition-colors"
              >
                <option value="">Unassigned</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-white/40 mb-1.5 block">MAC ID</span>
              <input
                value={newMacId}
                onChange={e => setNewMacId(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-white/40 mb-1.5 block">Initial status</span>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as MachineStatus)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-coffee-500/60 transition-colors"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
          </div>

          {/* Payment block */}
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/40">Payment</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`text-xs ${newIsFree ? 'text-green-400' : 'text-white/40'}`}>
                  {newIsFree ? 'Free (no payment)' : 'Paid (Razorpay UPI)'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={newIsFree}
                  onClick={() => setNewIsFree(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    newIsFree ? 'bg-green-500/70' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      newIsFree ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>

            {!newIsFree && (
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-white/40 mb-1 block">☕ Coffee (₹)</span>
                  <input
                    inputMode="decimal"
                    value={newCoffeeRupees}
                    onChange={e => setNewCoffeeRupees(e.target.value)}
                    placeholder="default"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-white/40 mb-1 block">🍵 Tea (₹)</span>
                  <input
                    inputMode="decimal"
                    value={newTeaRupees}
                    onChange={e => setNewTeaRupees(e.target.value)}
                    placeholder="default"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-white/40 mb-1 block">🥛 Milk (₹)</span>
                  <input
                    inputMode="decimal"
                    value={newMilkRupees}
                    onChange={e => setNewMilkRupees(e.target.value)}
                    placeholder="default"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); resetForm(); }}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="px-5 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold disabled:opacity-60 hover:bg-coffee-400 transition-colors"
            >
              {adding ? 'Creating…' : 'Create machine'}
            </button>
          </div>
        </form>
      )}

      {/* Post-create dialog */}
      {created && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setCreated(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass rounded-2xl p-6 w-full max-w-lg space-y-5 border border-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-green-400 mb-1">Machine created</div>
                <h2 className="text-lg font-semibold text-white">{created.name}</h2>
              </div>
              <button
                onClick={() => setCreated(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <CopyRow label="Machine URL"   value={created.url} field="url"
                     copy={copy} copied={copiedField === 'url'} link />
            {created.mac_id && (
              <CopyRow label="MAC ID"      value={created.mac_id} field="mac"
                       copy={copy} copied={copiedField === 'mac'} mono />
            )}
            {created.api_key && (
              <CopyRow label="API key (shown once — save it now!)" value={created.api_key} field="key"
                       copy={copy} copied={copiedField === 'key'} mono warn />
            )}

            <p className="text-xs text-white/40">
              Print the URL as a QR sticker on the physical machine. Customers scan it to start an order.
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setCreated(null)}
                className="px-5 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold hover:bg-coffee-400 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
                  <th className="text-left px-5 py-3.5 font-medium">Payment</th>
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

                    {/* Payment inline editor */}
                    <td className="px-5 py-4">
                      {editPaymentId === m.id ? (
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <label className="flex items-center gap-2">
                            <span className={`text-xs ${editIsFree ? 'text-green-400' : 'text-white/50'}`}>
                              {editIsFree ? 'Free' : 'Paid (Razorpay)'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditIsFree(v => !v)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editIsFree ? 'bg-green-500/70' : 'bg-white/10'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editIsFree ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                          </label>
                          {!editIsFree && (
                            <div className="flex gap-1.5">
                              <input
                                value={editCoffeeRupees}
                                onChange={e => setEditCoffeeRupees(e.target.value)}
                                placeholder="☕ ₹"
                                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-coffee-500/50"
                              />
                              <input
                                value={editTeaRupees}
                                onChange={e => setEditTeaRupees(e.target.value)}
                                placeholder="🍵 ₹"
                                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-coffee-500/50"
                              />
                              <input
                                value={editMilkRupees}
                                onChange={e => setEditMilkRupees(e.target.value)}
                                placeholder="🥛 ₹"
                                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-coffee-500/50"
                              />
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <button onClick={() => savePayment(m)} className="px-2.5 py-1 rounded-lg bg-coffee-500 text-black text-xs font-semibold hover:bg-coffee-400 transition-colors">Save</button>
                            <button onClick={() => setEditPaymentId(null)} className="px-2.5 py-1 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-colors">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => openPaymentEdit(m)} className="text-left group space-y-0.5">
                          {m.is_free ? (
                            <span className="text-xs text-green-400 font-medium">Free</span>
                          ) : (
                            <div className="text-xs text-white/50 space-y-0.5">
                              <div>☕ {m.price_coffee_paise != null ? `₹${m.price_coffee_paise / 100}` : 'default'}</div>
                              <div>🍵 {m.price_tea_paise   != null ? `₹${m.price_tea_paise   / 100}` : 'default'}</div>
                              <div>🥛 {m.price_milk_paise  != null ? `₹${m.price_milk_paise  / 100}` : 'default'}</div>
                            </div>
                          )}
                          <div className="text-[10px] text-white/20 group-hover:text-coffee-400 transition-colors">Edit →</div>
                        </button>
                      )}
                    </td>

                    {/* Status + online indicator */}
                    <td className="px-5 py-4">
                      <div className="space-y-1.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[m.status]}`}>
                          {m.status}
                        </span>
                        <div className={`flex items-center gap-1 text-[11px] ${isOnline(m) ? 'text-green-400' : 'text-white/25'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline(m) ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                          {isOnline(m) ? 'Online' : 'Offline'}
                        </div>
                      </div>
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

interface CopyRowProps {
  label:  string;
  value:  string;
  field:  string;
  copied: boolean;
  copy:   (text: string, field: string) => void;
  mono?:  boolean;
  warn?:  boolean;
  link?:  boolean;
}

function CopyRow({ label, value, field, copied, copy, mono, warn, link }: CopyRowProps) {
  return (
    <div>
      <div className={`text-xs uppercase tracking-wider mb-1.5 ${warn ? 'text-amber-400' : 'text-white/40'}`}>
        {label}
      </div>
      <div className={`flex items-stretch gap-2 rounded-xl border ${
        warn ? 'border-amber-400/30 bg-amber-400/5' : 'border-white/10 bg-white/5'
      }`}>
        <div className={`flex-1 px-3 py-2.5 text-sm break-all ${mono ? 'font-mono' : ''} text-white/90`}>
          {value}
        </div>
        {link && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="px-3 flex items-center text-white/50 hover:text-white border-l border-white/10 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        )}
        <button
          onClick={() => copy(value, field)}
          title="Copy"
          className="px-3 flex items-center text-white/50 hover:text-white border-l border-white/10 transition-colors"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
