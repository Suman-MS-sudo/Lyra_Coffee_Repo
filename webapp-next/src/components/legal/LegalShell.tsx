import Link from 'next/link';
import { ReactNode } from 'react';
import { BrandFooter } from '@/components/branding/BrandFooter';
import { BrandLogo, BrandWordmark } from '@/components/branding/BrandWordmark';

/**
 * Shared chrome for the static legal/policy pages
 * (About, Contact, Terms, Privacy, Refund, Shipping).
 *
 * These pages exist to satisfy Razorpay's live-mode activation
 * checks and to give customers a permanent, linkable record of
 * our policies.
 */
export function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title:        string;
  lastUpdated:  string;   // e.g. '6 May 2026'
  children:     ReactNode;
}) {
  return (
    <main className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo size={36} />
            <BrandWordmark size="sm" />
          </Link>
          <Link
            href="/"
            className="text-xs text-white/50 hover:text-coffee-400 transition-colors"
          >
            ← Home
          </Link>
        </div>
      </header>

      {/* Body */}
      <article className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-[11px] font-semibold tracking-[0.32em] text-lyra-pink uppercase">
            Lyra Enterprises
          </p>
          <h1 className="text-3xl font-semibold text-white mt-2">{title}</h1>
          <p className="text-white/40 text-xs mt-2">
            Last updated: {lastUpdated}
          </p>

          <div
            className="
              mt-8 space-y-4 text-[15px] leading-relaxed text-white/70
              [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-semibold
              [&_h2]:mt-10 [&_h2]:mb-3
              [&_h3]:text-white [&_h3]:text-base [&_h3]:font-semibold
              [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:text-white/70
              [&_strong]:text-white [&_strong]:font-semibold
              [&_a]:text-coffee-400 hover:[&_a]:underline
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ul]:my-3
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5 [&_ol]:my-3
              [&_li]:text-white/70
            "
          >
            {children}
          </div>
        </div>
      </article>

      <BrandFooter />
    </main>
  );
}
