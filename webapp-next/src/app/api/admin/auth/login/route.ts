import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { adminLoginSchema } from '@/lib/validators/schemas';
import { signAdminToken } from '@/lib/utils/jwt';
import { checkRateLimit, getClientIp, apiError } from '@/lib/utils/security';
import crypto from 'crypto';

// Pre-computed dummy hash for timing-safe comparison when user is not found.
// Must use the same encoding ('hex') as the real comparison below.
const DUMMY_PASSWORD_HASH = crypto.createHash('sha256').update('__dummy__').digest('hex');

export async function POST(req: NextRequest) {
  // ── Rate limit (5 attempts/min per IP) ─────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`admin-login:${ip}`, 5)) {
    return apiError('Too many login attempts. Please wait a minute.', 429);
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid credentials format', 422);
  }
  const { email, password } = parsed.data;

  // ── Fetch admin by email ────────────────────────────────────────
  const { data: admin } = await supabaseAdmin
    .from('coffee_admins')
    .select('id, email, name, password_hash, is_active')
    .eq('email', email.toLowerCase())
    .single();

  // Always compute a hash even on miss to prevent timing attacks
  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  if (!admin || !admin.is_active) {
    // Constant-time dummy comparison to normalise timing when the user doesn't exist.
    try {
      crypto.timingSafeEqual(
        Buffer.from(passwordHash,       'hex'),
        Buffer.from(DUMMY_PASSWORD_HASH, 'hex'),
      );
    } catch { /* ignore */ }
    return apiError('Invalid email or password', 401);
  }

  // ── Constant-time password verification ─────────────────────────
  // Note: Use bcrypt in production (password_hash should be bcrypt).
  // Below uses SHA-256 for simplicity — swap for bcryptjs.compare() in prod.
  let match = false;
  try {
    match = crypto.timingSafeEqual(
      Buffer.from(passwordHash,       'hex'),
      Buffer.from(admin.password_hash, 'hex'),
    );
  } catch {
    match = false;
  }

  if (!match) {
    return apiError('Invalid email or password', 401);
  }

  // ── Update last_login_at ────────────────────────────────────────
  await supabaseAdmin
    .from('coffee_admins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', admin.id);

  // ── Issue JWT ───────────────────────────────────────────────────
  const token = await signAdminToken({
    sub:   admin.id,
    email: admin.email,
    name:  admin.name,
  });

  const resp = Response.json({ name: admin.name, email: admin.email });
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  resp.headers.set(
    'Set-Cookie',
    `admin_token=${token}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${8 * 3600}`,
  );
  return resp;
}
