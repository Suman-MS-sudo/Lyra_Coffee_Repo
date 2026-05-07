import crypto from 'crypto';
import type { NextRequest } from 'next/server';

// ── Razorpay signature verification ──────────────────────────────

/**
 * Verify Razorpay payment signature (client-side checkout flow).
 * MUST be called server-side only — uses the key secret.
 */
export function verifyRazorpayPaymentSignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}: {
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  razorpay_signature:  string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set');

  const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(razorpay_signature, 'hex'),
      Buffer.from(expected,           'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Verify Razorpay webhook signature.
 * rawBody MUST be the raw Buffer (before JSON.parse).
 */
export function verifyRazorpayWebhookSignature(
  rawBody:   Buffer | string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected,  'hex'),
    );
  } catch {
    return false;
  }
}

// ── Machine API key verification ─────────────────────────────────

/**
 * Compute a SHA-256 hex digest of a plaintext API key.
 * Used both when storing new machine keys and verifying inbound requests.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a cryptographically secure machine API key.
 * Returns the plaintext key (shown once) and its hash (stored in DB).
 */
export function generateMachineApiKey(): { key: string; hash: string } {
  const key  = crypto.randomBytes(32).toString('hex');
  const hash = hashApiKey(key);
  return { key, hash };
}

// ── Rate limiting (in-memory, per-route) ─────────────────────────
// For production, replace with Redis (Upstash) or Vercel KV.

interface RateLimitEntry {
  count:  number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS    = parseInt(process.env.RATE_LIMIT_WINDOW_MS    ?? '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '20',    10);

/**
 * Returns true if the request is ALLOWED (not rate-limited).
 * Key should be: `${route}:${ip}` or `${route}:${adminId}`.
 */
export function checkRateLimit(key: string, maxReq = MAX_REQUESTS, windowMs = WINDOW_MS): boolean {
  const now   = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxReq) return false;

  entry.count++;
  return true;
}

/**
 * Extract the real client IP from Next.js request headers.
 * Handles Vercel, Cloudflare, and plain TCP.
 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')           ??
    req.headers.get('cf-connecting-ip')    ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

// ── Standard JSON error responses ────────────────────────────────

export function apiError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// ── Drink pricing (single regular 100ml size) ─────────────────

const DEFAULT_PRICES_PAISE: Record<string, number> = {
  coffee: 2500,
  tea:    2000,
  milk:   1500,
};

/** Platform-default price for a drink (in paise). */
export function getDrinkPrice(drink: string): number {
  return DEFAULT_PRICES_PAISE[drink] ?? 2500;
}

/** Resolve effective price for a machine + drink. Customer overrides win;
 *  null override falls back to platform default. */
export function getMachineDrinkPrice(
  machine: { is_free: boolean | null; price_coffee_paise: number | null; price_tea_paise: number | null },
  drink: 'coffee' | 'tea' | 'milk',
): number {
  if (machine.is_free) return 0;
  let override: number | null | undefined = null;
  if (drink === 'coffee') override = machine.price_coffee_paise;
  else if (drink === 'tea') override = machine.price_tea_paise;
  // For milk, no per-machine override yet; fallback to default
  if (typeof override === 'number' && override >= 0) return override;
  return getDrinkPrice(drink);
}
