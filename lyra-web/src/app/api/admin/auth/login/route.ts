// ================================================================
//  POST /api/admin/auth/login
//  Verifies admin credentials and issues a JWT cookie
// ================================================================
import { NextRequest } from 'next/server';
import { adminLoginSchema } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabase-server';
import { signAdminToken, ADMIN_COOKIE, cookieOptions } from '@/lib/auth';
import { apiError, apiOk, isRateLimited, getClientIp } from '@/lib/utils';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Tighter rate limit on login (5 rpm)
  if (isRateLimited(`login:${ip}`)) return apiError('Too many login attempts', 429);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON'); }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return apiError('Invalid credentials');

  const { email, password } = parsed.data;

  const { data: admin } = await supabaseAdmin
    .from('coffee_admins')
    .select('id, email, password_hash, role')
    .eq('email', email.toLowerCase())
    .single();

  // Always run bcrypt even if admin not found to prevent timing attacks
  const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxx';
  const hashToCheck = admin?.password_hash ?? dummyHash;
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!valid || !admin) return apiError('Invalid credentials', 401);

  const token = await signAdminToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role,
  });

  // Update last login
  await supabaseAdmin
    .from('coffee_admins')
    .update({ last_login: new Date().toISOString() })
    .eq('id', admin.id);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, cookieOptions(8 * 60 * 60));

  return apiOk({ ok: true, role: admin.role });
}
