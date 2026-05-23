import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { customerLoginSchema } from '@/lib/validators/schemas';
import { signCustomerToken } from '@/lib/utils/jwt';
import { checkRateLimit, getClientIp, apiError } from '@/lib/utils/security';
import crypto from 'crypto';

const DUMMY_PASSWORD_HASH = crypto.createHash('sha256').update('__dummy__').digest('hex');

export async function POST(req: NextRequest) {
  // ── Rate limit (5 attempts/min per IP) ─────────────────────────
  const ip = getClientIp(req);
  if (!checkRateLimit(`customer-login:${ip}`, 5)) {
    return apiError('Too many login attempts. Please wait a minute.', 429);
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = customerLoginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid credentials format', 422);
  }
  const { email, password } = parsed.data;

  // ── Fetch customer by email ────────────────────────────────────
  const { data: customer } = await supabaseAdmin
    .from('coffee_customers')
    .select('id, email, name, password_hash, is_active')
    .eq('email', email.toLowerCase())
    .single();

  // Always compute hash to prevent timing attacks
  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  if (!customer || !customer.is_active) {
    try {
      crypto.timingSafeEqual(
        Buffer.from(passwordHash,        'hex'),
        Buffer.from(DUMMY_PASSWORD_HASH, 'hex'),
      );
    } catch { /* ignore */ }
    return apiError('Invalid email or password', 401);
  }

  // ── Constant-time password verification ───────────────────────
  let match = false;
  try {
    match = crypto.timingSafeEqual(
      Buffer.from(passwordHash,          'hex'),
      Buffer.from(customer.password_hash, 'hex'),
    );
  } catch {
    match = false;
  }

  if (!match) {
    return apiError('Invalid email or password', 401);
  }

  // ── Update last_login_at ───────────────────────────────────────
  await supabaseAdmin
    .from('coffee_customers')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', customer.id);

  // ── Issue JWT ──────────────────────────────────────────────────
  const token = await signCustomerToken({
    sub:   customer.id,
    email: customer.email,
    name:  customer.name,
  });

  const resp = Response.json({ name: customer.name, email: customer.email });
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  resp.headers.set(
    'Set-Cookie',
    `customer_token=${token}; HttpOnly;${secure} SameSite=Lax; Path=/; Max-Age=${8 * 3600}`,
  );
  return resp;
}
