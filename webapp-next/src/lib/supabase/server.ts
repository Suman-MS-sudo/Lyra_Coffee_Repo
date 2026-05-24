import { createClient } from '@supabase/supabase-js';
import { createLocalClient } from '@/lib/db/sqlite-adapter';

/**
 * Server-side DB client.
 *
 * LOCAL_MODE=true  → SQLite via sqlite-adapter (Pi 5 / offline)
 * otherwise        → Supabase with service_role key (cloud)
 *
 * Bypasses RLS in both modes — only use in Server Actions and API Routes.
 * NEVER expose this client or its key to the browser.
 */
function makeClient() {
  if (process.env.LOCAL_MODE === 'true') {
    const dbPath = process.env.SQLITE_DB_PATH || '/var/lib/lyra/lyra.db';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createLocalClient(dbPath) as any;
  }

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[DB] Set LOCAL_MODE=true for Pi/offline mode, or provide ' +
      'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for cloud mode.',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken:   false,
      persistSession:     false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

export const supabaseAdmin = makeClient();
