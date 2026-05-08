import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Server-side Supabase client with service_role key.
 * Bypasses RLS — only use in Server Actions and API Routes.
 * NEVER expose this client or its key to the browser.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken:  false,
    persistSession:    false,
    detectSessionInUrl: false,
  },
  global: {
    // Force every Supabase HTTP request to bypass Next.js's data cache.
    // Without this, Next.js 14 caches identical GET requests (e.g. SELECT
    // queries) indefinitely, returning stale DB rows even when the table
    // has been updated seconds ago.
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
  },
});
