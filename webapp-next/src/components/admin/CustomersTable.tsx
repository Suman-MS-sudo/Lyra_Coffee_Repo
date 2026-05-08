'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  PlusCircle, Trash2, Building2, CheckCircle, XCircle,
  Pencil, KeyRound, X, Loader2,
} from 'lucide-react';
import type { CoffeeCustomer } from '@/lib/types/database';

interface Props { initialCustomers: CoffeeCustomer[] }

const INPUT = `bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm
  text-white placeholder-white/30 outline-none focus:border-coffee-500/60 transition-colors w-full`;

// ── tiny modal shell ──────────────────────────────────────────────
function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CustomersTable({ initialCustomers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [customers, setCustomers] = useState<CoffeeCustomer[]>(initialCustomers);
  useEffect(() => { setCustomers(initialCustomers); }, [initialCustomers]);

  // ── add form ──────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', company: '' });
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(), email: addForm.email.trim(),
          password: addForm.password, company: addForm.company.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      toast.success('Customer created');
      setAddForm({ name: '', email: '', password: '', company: '' });
      setShowAdd(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create customer');
    } finally { setAdding(false); }
  };

  // ── edit modal ────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<CoffeeCustomer | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', company: '' });
  const [saving, setSaving] = useState(false);

  const openEdit = (c: CoffeeCustomer) => {
    setEditTarget(c);
    setEditForm({ name: c.name, email: c.email, company: c.company ?? '' });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    editForm.name.trim(),
          email:   editForm.email.trim(),
          company: editForm.company.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const { data } = await res.json();
      setCustomers(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...data } : c));
      toast.success('Customer updated');
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally { setSaving(false); }
  };

  // ── password reset modal ──────────────────────────────────────
  const [pwdTarget, setPwdTarget] = useState<CoffeeCustomer | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [resetting, setResetting] = useState(false);

  const handlePwdReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/customers/${pwdTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      toast.success(`Password reset for ${pwdTarget.name}`);
      setPwdTarget(null);
      setNewPwd('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally { setResetting(false); }
  };

  // ── toggle active ─────────────────────────────────────────────
  const handleToggle = async (c: CoffeeCustomer) => {
    const newActive = !c.is_active;
    setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_active: newActive } : x));
    const res = await fetch(`/api/admin/customers/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newActive }),
    });
    if (!res.ok) {
      setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_active: c.is_active } : x));
      toast.error('Failed to update status');
    } else {
      toast.success(`Customer ${newActive ? 'activated' : 'deactivated'}`);
    }
  };

  // ── delete ────────────────────────────────────────────────────
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

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold hover:bg-coffee-400 active:scale-95 transition-all"
          >
            <PlusCircle size={16} />
            Add Customer
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="glass rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name *" required className={INPUT} />
            <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email address *" required className={INPUT} />
            <input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Password (min 8 chars) *" required minLength={8} className={INPUT} />
            <input value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
              placeholder="Company (optional)" className={INPUT} />
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={adding}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold disabled:opacity-60 hover:bg-coffee-400 transition-colors">
                {adding && <Loader2 size={14} className="animate-spin" />}
                {adding ? 'Creating…' : 'Create Customer'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors">
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
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-white font-medium">{c.name}</p>
                        <p className="text-white/40 text-xs">{c.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.company ? (
                          <div className="flex items-center gap-1.5 text-white/50 text-xs">
                            <Building2 size={12} />{c.company}
                          </div>
                        ) : <span className="text-white/20">—</span>}
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
                        {c.last_login_at ? new Date(c.last_login_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                            title="Edit customer"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setPwdTarget(c); setNewPwd(''); }}
                            className="p-1.5 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                            title="Reset password"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Delete customer"
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

      {/* Edit modal */}
      {editTarget && (
        <Modal title={`Edit — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Full Name</label>
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                required className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                required className={INPUT} />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Company</label>
              <input value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Optional" className={INPUT} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-coffee-500 text-black text-sm font-semibold disabled:opacity-60 hover:bg-coffee-400 transition-colors">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Password reset modal */}
      {pwdTarget && (
        <Modal title={`Reset Password — ${pwdTarget.name}`} onClose={() => setPwdTarget(null)}>
          <form onSubmit={handlePwdReset} className="space-y-3">
            <p className="text-white/40 text-sm">Set a new password for <span className="text-white/70">{pwdTarget.email}</span>.</p>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">New Password</label>
              <input
                type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                required minLength={8} placeholder="Min 8 characters" className={INPUT}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={resetting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-500 text-black text-sm font-semibold disabled:opacity-60 hover:bg-yellow-400 transition-colors">
                {resetting && <Loader2 size={14} className="animate-spin" />}
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
              <button type="button" onClick={() => setPwdTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
