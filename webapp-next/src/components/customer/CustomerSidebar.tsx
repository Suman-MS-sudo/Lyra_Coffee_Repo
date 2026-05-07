'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, CpuIcon, Settings, LogOut, Menu, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { BrandMonogram, BrandWordmark } from '@/components/branding/BrandWordmark';

const NAV = [
  { href: '/customer',          label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/customer/machines', label: 'My Machines', icon: CpuIcon         },
  { href: '/customer/settings', label: 'Settings',    icon: Settings        },
] as const;

export default function CustomerSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch('/api/customer/auth/logout', { method: 'POST' });
      router.push('/customer/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    } finally {
      setBusy(false);
    }
  }

  const navContent = (
    <>
      <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
        <BrandMonogram size={36} />
        <div className="min-w-0">
          <BrandWordmark size="sm" />
          <p className="text-white/30 text-[11px] tracking-wider uppercase">Customer Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/customer'
            ? pathname === '/customer'
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                transition-colors ${active
                  ? 'bg-coffee-500/15 text-coffee-400'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-5 border-t border-white/5 pt-3">
        <button
          onClick={handleLogout}
          disabled={busy}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm
            font-medium text-white/40 hover:text-red-400 hover:bg-red-400/10
            transition-colors disabled:opacity-50"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/5 flex items-center justify-between px-4">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <BrandWordmark size="sm" withLogo />
          <span className="text-[10px] uppercase tracking-widest text-white/30">Customer</span>
        </div>
        <div className="w-9" />
      </header>

      {open && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-72 sm:w-64 bg-[#111] border-r border-white/5 flex flex-col z-50
          transition-transform duration-300 ease-out
          lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="lg:hidden absolute top-4 right-3 p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>
        {navContent}
      </aside>
    </>
  );
}
