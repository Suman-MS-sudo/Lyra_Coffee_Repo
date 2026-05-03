'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CoffeeMachineAdmin } from '@/types';

interface Props {
  machines: CoffeeMachineAdmin[];
}

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-[#6dbf67]/20 text-[#6dbf67]',
  inactive:    'bg-[#7a7062]/20 text-[#7a7062]',
  maintenance: 'bg-yellow-500/20 text-yellow-400',
};

export function MachinesTable({ machines }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    await fetch('/api/admin/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location }),
    });
    setAdding(false);
    setShowAdd(false);
    setName(''); setLocation('');
    router.refresh();
  };

  const handleStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/machines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this machine?')) return;
    await fetch(`/api/admin/machines/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-xl bg-[#c8861a] text-[#0a0a0a] text-sm font-semibold"
        >
          + Add Machine
        </button>
      </div>

      {/* Add machine form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Machine name *"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-[#0a0a0a] border border-[#2e2e2e] rounded-xl px-3 py-2 text-sm text-[#f0ece4] outline-none focus:border-[#c8861a]"
          />
          <input
            placeholder="Location (optional)"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="bg-[#0a0a0a] border border-[#2e2e2e] rounded-xl px-3 py-2 text-sm text-[#f0ece4] outline-none focus:border-[#c8861a]"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 rounded-xl bg-[#c8861a] text-[#0a0a0a] text-sm font-semibold disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Create'}
          </button>
        </form>
      )}

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2e2e2e] text-[#7a7062] text-xs uppercase tracking-widest">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Last Ping</th>
                <th className="text-left px-4 py-3">API Key</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-[#7a7062]">No machines yet</td></tr>
              )}
              {machines.map(m => {
                const isOnline = m.last_ping
                  ? Date.now() - new Date(m.last_ping).getTime() < 10 * 60_000
                  : false;
                return (
                  <tr key={m.id} className="border-b border-[#2e2e2e] last:border-0 hover:bg-[#111] transition-colors">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-[#7a7062]">{m.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status]}`}>
                        {m.status}
                      </span>
                      {isOnline && <span className="ml-1 w-2 h-2 inline-block rounded-full bg-[#6dbf67]" />}
                    </td>
                    <td className="px-4 py-3 text-[#7a7062] text-xs">
                      {m.last_ping ? new Date(m.last_ping).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#7a7062]">
                      {m.api_key.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatus(m.id, m.status === 'active' ? 'inactive' : 'active')}
                          className="text-xs px-2 py-1 rounded-lg border border-[#2e2e2e] hover:border-[#c8861a] transition-colors"
                        >
                          {m.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-xs px-2 py-1 rounded-lg border border-[#2e2e2e] hover:border-red-500 text-[#7a7062] hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
