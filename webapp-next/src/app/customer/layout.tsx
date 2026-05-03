import type { Metadata } from 'next';
import CustomerSidebar from '@/components/customer/CustomerSidebar';

export const metadata: Metadata = {
  title: { template: '%s — Lyra Customer Portal', default: 'Lyra Customer Portal' },
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a]">
      <CustomerSidebar />
      <main className="min-w-0 lg:ml-64 pt-16 lg:pt-0 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto pt-4 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
