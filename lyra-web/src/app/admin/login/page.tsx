'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.replace('/admin');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-[#c8861a]">Lyra</span> Admin
          </h1>
          <p className="text-[#7a7062] text-sm mt-1">Sign in to manage your machines</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-[#7a7062] uppercase tracking-widest mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-xl px-4 py-3 text-sm text-[#f0ece4] outline-none focus:border-[#c8861a] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[#7a7062] uppercase tracking-widest mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[#0a0a0a] border border-[#2e2e2e] rounded-xl px-4 py-3 text-sm text-[#f0ece4] outline-none focus:border-[#c8861a] transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#c8861a] text-[#0a0a0a] font-semibold disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
            )}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
