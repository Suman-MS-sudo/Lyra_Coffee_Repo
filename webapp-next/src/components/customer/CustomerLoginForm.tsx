'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BrandMonogram, BrandWordmark } from '@/components/branding/BrandWordmark';

export default function CustomerLoginForm() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/customer/auth/login', {
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
      router.push('/customer');
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
        <p className="text-white/40 text-sm mt-2">Customer Portal — Sign in to manage your machines</p>
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
            placeholder="you@example.com"
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
            bg-coffee-500 text-black font-semibold text-sm
            hover:bg-coffee-400 active:scale-[0.98]
            disabled:opacity-60 disabled:cursor-not-allowed
            transition-all"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-white/30 text-xs mt-6">
        <Link href="/" className="hover:text-white/60 transition-colors">← Back to home</Link>
      </p>
    </div>
  );
}
