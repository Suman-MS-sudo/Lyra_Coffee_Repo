import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Login — Lyra Admin' };

import AdminLoginForm from '@/components/admin/AdminLoginForm';

export default function AdminLoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-[#0a0a0a]">
      <AdminLoginForm />
    </main>
  );
}
