'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/admin',          label: '📊  Dashboard', exact: true },
  { href: '/admin/machines', label: '🖥️  Machines',  exact: false },
  { href: '/admin/orders',   label: '📋  Orders',    exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  };

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-[#111] border-r border-[#2e2e2e] px-4 py-6">
      <div className="mb-8 px-2">
        <h1 className="text-lg font-bold">
          <span className="text-[#c8861a]">Lyra</span> Admin
        </h1>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(n => {
          const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-2.5 rounded-xl text-sm transition-colors
                ${active
                  ? 'bg-[#c8861a]/10 text-[#c8861a] font-medium'
                  : 'text-[#7a7062] hover:text-[#f0ece4] hover:bg-[#1a1a1a]'
                }`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="px-3 py-2.5 rounded-xl text-sm text-[#7a7062] hover:text-red-400 hover:bg-red-950/30 transition-colors text-left"
      >
        🚪  Sign Out
      </button>
    </aside>
  );
}
