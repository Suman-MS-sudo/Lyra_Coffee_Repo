#!/usr/bin/env node
// ================================================================
//  scripts/seed-admin.js
//  Creates the first admin user in coffee_admins.
//
//  Usage:
//    cp .env.example .env.local
//    # fill in Supabase credentials
//    node scripts/seed-admin.js
// ================================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('\n🔧  Lyra Coffee — Admin Seed\n');
  const email    = await ask('Admin email: ');
  const password = await ask('Admin password (min 8 chars): ');
  rl.close();

  if (!email || !password || password.length < 8) {
    console.error('Invalid input.'); process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('coffee_admins')
    .insert({ email: email.toLowerCase(), password_hash: hash, role: 'superadmin' })
    .select('id, email, role')
    .single();

  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log('\n✅  Admin created:', data);
}

main().catch(e => { console.error(e); process.exit(1); });
