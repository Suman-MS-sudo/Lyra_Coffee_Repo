import type { Metadata } from 'next';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const metadata: Metadata = { title: 'Lyra — Admin' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex">
      <AdminSidebar />
      <main className="flex-1 ml-0 md:ml-56 p-6 overflow-auto">{children}</main>
    </div>
  );
}
