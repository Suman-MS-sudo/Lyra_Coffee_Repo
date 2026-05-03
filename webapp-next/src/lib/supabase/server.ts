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
// Next.js patches global fetch and adds an opaque data cache. supabase-js
// makes its REST calls via fetch, so a plain SELECT (GET) ends up cached
// indefinitely even when route handlers set `dynamic = 'force-dynamic'`.
// That bug manifests as the /api/machine/[id]/status endpoint returning
// a stale `last_seen_at` even after fresh heartbeat UPDATEs land in the
// DB. Force every supabase request to bypass the data cache.
const noCacheFetch: typeof fetch = (input, init = {}) =>
  fetch(input, { ...init, cache: 'no-store' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken:  false,
    persistSession:    false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: noCacheFetch,
  },
});
