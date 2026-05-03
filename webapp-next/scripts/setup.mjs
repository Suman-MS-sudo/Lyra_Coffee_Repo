#!/usr/bin/env node
// ================================================================
//  scripts/setup.mjs
//  One-time database bootstrap:
//    1. Generates ADMIN_JWT_SECRET & CUSTOMER_JWT_SECRET in .env.local
//    2. Generates supabase/setup-complete.sql (schema + seed)
//    3. Checks if tables exist, then inserts initial admin + customer
//
//  Usage (from webapp-next dir):
//    node scripts/setup.mjs
// ================================================================

import crypto from 'node:crypto';
import fs     from 'node:fs';
import path   from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient }  from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────
function readEnvFile() {
  const env = {};
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .forEach(line => {
      if (line.startsWith('#') || !line.trim()) return;
      const idx = line.indexOf('=');
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
  return env;
}

function writeEnvValue(key, value) {
  const envPath = path.join(ROOT, '.env.local');
  let content   = fs.readFileSync(envPath, 'utf8');
  const regex   = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
}

const sha256 = str => crypto.createHash('sha256').update(str).digest('hex');
const rndSecret = () => crypto.randomBytes(32).toString('hex');

// ── Initial credentials (change after first login) ───────────────
const ADMIN_EMAIL       = 'admin@lyra.coffee';
const ADMIN_PASSWORD    = 'Admin@123456';
const ADMIN_NAME        = 'Lyra Admin';

const CUSTOMER_EMAIL    = 'customer@lyra.coffee';
const CUSTOMER_PASSWORD = 'Customer@123456';
const CUSTOMER_NAME     = 'Demo Customer';
const CUSTOMER_COMPANY  = 'Lyra Demo Co.';

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n☕  Lyra Coffee Machine — Database Setup\n');

  let env = readEnvFile();

  // 1. Generate JWT secrets if they're still placeholders
  const needAdmin    = !env.ADMIN_JWT_SECRET    || env.ADMIN_JWT_SECRET.includes('change_me')    || env.ADMIN_JWT_SECRET.length < 32;
  const needCustomer = !env.CUSTOMER_JWT_SECRET || env.CUSTOMER_JWT_SECRET.includes('change_me') || env.CUSTOMER_JWT_SECRET.length < 32;

  if (needAdmin)    { writeEnvValue('ADMIN_JWT_SECRET',    rndSecret()); console.log('✅  Generated ADMIN_JWT_SECRET'); }
  if (needCustomer) { writeEnvValue('CUSTOMER_JWT_SECRET', rndSecret()); console.log('✅  Generated CUSTOMER_JWT_SECRET'); }
  if (needAdmin || needCustomer) env = readEnvFile();

  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE || SERVICE_ROLE.length < 20) {
    console.error('\n❌  Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local\n');
    process.exit(1);
  }

  // 2. Generate setup-complete.sql (schema + seed inserts)
  const schemaSql    = fs.readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8');
  const adminHash    = sha256(ADMIN_PASSWORD);
  const customerHash = sha256(CUSTOMER_PASSWORD);

  const seedSql = `
-- ================================================================
--  Seed: initial admin + customer (run once, safe to re-run)
-- ================================================================
INSERT INTO coffee_admins (email, password_hash, name, is_active)
VALUES
  ('${ADMIN_EMAIL}', '${adminHash}', '${ADMIN_NAME}', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO coffee_customers (email, password_hash, name, company, is_active)
VALUES
  ('${CUSTOMER_EMAIL}', '${customerHash}', '${CUSTOMER_NAME}', '${CUSTOMER_COMPANY}', true)
ON CONFLICT (email) DO NOTHING;
`;

  const setupSqlPath = path.join(ROOT, 'supabase', 'setup-complete.sql');
  fs.writeFileSync(setupSqlPath, schemaSql + '\n' + seedSql, 'utf8');
  console.log('📄  Generated: supabase/setup-complete.sql\n');

  // 3. Connect & check if tables exist
  console.log('🔌  Connecting to:', SUPABASE_URL);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use a regular SELECT (not HEAD) — PostgREST returns schema error for missing tables
  const { error: tableCheck } = await supabase
    .from('coffee_admins')
    .select('email')
    .limit(0);

  const isTableMissing = (err) =>
    err && (err.code === '42P01' || err.message?.includes('schema cache') || err.message?.includes('Could not find'));

  if (isTableMissing(tableCheck)) {
    console.log('\n⚠️   Tables not found — run the schema first:\n');
    console.log('  ┌─────────────────────────────────────────────────────────────┐');
    console.log('  │  1. Open https://supabase.com/dashboard                      │');
    console.log('  │  2. Select your project → SQL Editor → New query             │');
    console.log('  │  3. Open and paste the contents of:                           │');
    console.log(`  │       webapp-next/supabase/setup-complete.sql                 │`);
    console.log('  │  4. Click Run (or press Ctrl+Enter)                           │');
    console.log('  │  5. Re-run: node scripts/setup.mjs                            │');
    console.log('  └─────────────────────────────────────────────────────────────┘\n');
    return;
  }

  if (tableCheck) {
    console.error('\n❌  Supabase connection error:', tableCheck.message);
    process.exit(1);
  }

  // 4. Tables exist — upsert seed data
  const { error: adminErr } = await supabase
    .from('coffee_admins')
    .upsert(
      { email: ADMIN_EMAIL, password_hash: adminHash, name: ADMIN_NAME, is_active: true },
      { onConflict: 'email' }
    );
  if (isTableMissing(adminErr)) {
    console.log('\n⚠️   Tables not found — please run supabase/setup-complete.sql in the Supabase SQL Editor first, then re-run this script.\n');
    return;
  }
  if (adminErr) { console.error('❌  Admin upsert failed:', adminErr.message); process.exit(1); }

  const { error: custErr } = await supabase
    .from('coffee_customers')
    .upsert(
      { email: CUSTOMER_EMAIL, password_hash: customerHash, name: CUSTOMER_NAME, company: CUSTOMER_COMPANY, is_active: true },
      { onConflict: 'email' }
    );
  if (isTableMissing(custErr)) {
    console.log('\n⚠️   coffee_customers table missing — run setup-complete.sql in the Supabase SQL Editor first.\n');
    return;
  }
  if (custErr) { console.error('❌  Customer upsert failed:', custErr.message); process.exit(1); }

  // 5. Done
  console.log('\n' + '─'.repeat(65));
  console.log('  🎉  Database seeded!  Login credentials:');
  console.log('─'.repeat(65));
  console.log(`  ADMIN     → /admin/login`);
  console.log(`  Email   : ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('─'.repeat(65));
  console.log(`  CUSTOMER  → /customer/login`);
  console.log(`  Email   : ${CUSTOMER_EMAIL}`);
  console.log(`  Password: ${CUSTOMER_PASSWORD}`);
  console.log('─'.repeat(65) + '\n');
  console.log('  ⚠️  Change these passwords after first login!\n');
}

main().catch(err => { console.error(err); process.exit(1); });
