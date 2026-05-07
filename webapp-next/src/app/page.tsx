import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import OrderFlow from '@/components/order/OrderFlow';
import { BrandFooter } from '@/components/branding/BrandFooter';
import { BrandWordmark, BrandLogo } from '@/components/branding/BrandWordmark';
import { Shield, User } from 'lucide-react';

interface SearchParams { machine?: string }

/** Dynamic page — fresh data on every request (no caching stale machine status). */
export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawId = searchParams.machine ?? '';

  // No machine param → show landing page
  if (!rawId) {
    return <LandingPage />;
  }

  // Validate UUID format — rejects injection attempts immediately
  const parseResult = uuidSchema.safeParse(rawId);
  if (!parseResult.success) {
    return <InvalidMachine message="Invalid machine ID in the QR code." />;
  }

  const machineId = parseResult.data;

  const { data: machine, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, is_free, price_coffee_paise, price_tea_paise, price_milk_paise, last_seen_at')
    .eq('id', machineId)
    .single();

  if (error || !machine) {
    return <InvalidMachine message="Machine not found." />;
  }

  if (machine.status !== 'active') {
    return (
      <InvalidMachine
        message={
          machine.status === 'maintenance'
            ? 'This machine is under maintenance. Please try again shortly.'
            : 'This machine is currently offline.'
        }
      />
    );
  }

  return <OrderFlow machine={machine} />;
}

function LandingPage() {
  return (
    <main className="min-h-dvh flex flex-col">
      {/* Hero / portal section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Brand */}
        <div className="text-center mb-3 max-w-md">
          <div className="flex justify-center mb-5">
            <BrandLogo size={96} className="drop-shadow-[0_8px_24px_rgba(212,162,74,0.35)]" />
          </div>
          <p className="text-[11px] font-semibold tracking-[0.32em] text-lyra-pink uppercase mb-4">
            Authentic South Indian · Filter Coffee &amp; Tea
          </p>
          <h1>
            <BrandWordmark size="lg" />
          </h1>
          <p className="display italic text-white/60 text-base mt-4">
            “Freshly brewed, just like home.”
          </p>
          <p className="text-white/45 text-sm mt-3 max-w-sm mx-auto">
            Smart vending for kaapi &amp; chai — order, monitor and operate your Lyra machines.
          </p>
        </div>

        {/* Portal cards */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-10">
          <Link
            href="/customer/login"
            className="flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl
              bg-white/5 border border-white/10 hover:border-coffee-500/40 hover:bg-white/8
              transition-all group text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-coffee-500/15 flex items-center justify-center
              group-hover:bg-coffee-500/25 transition-colors">
              <User size={22} className="text-coffee-400" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Customer Portal</p>
              <p className="text-white/40 text-xs mt-0.5">Manage your machines</p>
            </div>
          </Link>

          <Link
            href="/admin/login"
            className="flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl
              bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8
              transition-all group text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/8 flex items-center justify-center
              group-hover:bg-white/12 transition-colors">
              <Shield size={22} className="text-white/60" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Admin Portal</p>
              <p className="text-white/40 text-xs mt-0.5">Full system access</p>
            </div>
          </Link>
        </div>

        <div className="ornament-divider mt-10 mb-2 w-full max-w-md">
          <span>Scan · Customise · Sip</span>
        </div>
        <p className="text-white/30 text-xs mt-3">
          To order filter coffee or tea, scan the QR code on a Lyra machine.
        </p>
      </section>

      <BrandFooter />
    </main>
  );
}

function InvalidMachine({ message }: { message: string }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex flex-col items-center gap-3">
        <BrandLogo size={64} />
        <BrandWordmark size="md" />
      </div>
      <h1 className="text-xl font-semibold text-white/80 mb-2">Oops!</h1>
      <p className="text-white/40 text-sm max-w-xs">{message}</p>
      <Link href="/" className="mt-6 text-coffee-400 text-sm hover:underline">← Back to home</Link>
    </main>
  );
}
