'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BrandMonogram, BrandWordmark } from '@/components/branding/BrandWordmark';

export default function AdminLoginForm() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Login failed');
        return;
      }
      const { name } = await res.json();
      toast.success(`Welcome back, ${name}!`);
      router.push('/admin');
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <BrandMonogram size={56} />
        </div>
        <BrandWordmark size="md" />
        <p className="text-white/40 text-sm mt-2">Admin Panel — Sign in to manage your machines</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl
              px-4 py-3 text-white placeholder-white/20 text-sm
              focus:outline-none focus:border-coffee-500 focus:ring-1 focus:ring-coffee-500
              transition-colors"
            placeholder="admin@lyra.coffee"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl
              px-4 py-3 text-white placeholder-white/20 text-sm
              focus:outline-none focus:border-coffee-500 focus:ring-1 focus:ring-coffee-500
              transition-colors"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-coffee-500 hover:bg-coffee-400
            disabled:opacity-50 text-white font-semibold text-sm
            transition-all mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
