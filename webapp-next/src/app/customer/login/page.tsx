import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Login — Lyra Customer Portal' };

import CustomerLoginForm from '@/components/customer/CustomerLoginForm';

export default function CustomerLoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 bg-[#0a0a0a]">
      <CustomerLoginForm />
    </main>
  );
}
