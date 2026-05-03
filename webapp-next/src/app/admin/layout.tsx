import type { Metadata } from 'next';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const metadata: Metadata = {
  title: { template: '%s — Lyra Admin', default: 'Lyra Admin' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="min-w-0 lg:ml-64 pt-16 lg:pt-0 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto pt-4 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
