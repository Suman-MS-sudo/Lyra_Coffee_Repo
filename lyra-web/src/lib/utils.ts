// ================================================================
//  Pricing and in-memory rate limiter helpers
// ================================================================
import type { DrinkType, DrinkCustomization } from '@/types';

// ── Pricing ───────────────────────────────────────────────────────
const BASE_PRICE: Record<DrinkType, number> = {
  coffee: parseInt(process.env.PRICE_COFFEE_PAISE ?? '2500', 10),
  tea: parseInt(process.env.PRICE_TEA_PAISE ?? '2000', 10),
};

const SIZE_ADDER: Record<DrinkCustomization['size'], number> = {
  small: -300,
  regular: 0,
  large: 500,
};

export function calculatePrice(
  drink: DrinkType,
  customization: DrinkCustomization
): number {
  return BASE_PRICE[drink] + SIZE_ADDER[customization.size];
}

// ── Simple in-memory rate limiter (per-IP, sliding window) ─────────
// For production, replace with Redis-backed limiter (upstash/ratelimit).
const ipWindows = new Map<string, number[]>();
const RPM = parseInt(process.env.RATE_LIMIT_RPM ?? '20', 10);

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const hits = (ipWindows.get(ip) ?? []).filter(t => now - t < window);
  hits.push(now);
  ipWindows.set(ip, hits);
  return hits.length > RPM;
}

// Prune old keys every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of ipWindows.entries()) {
    if (hits.every(t => now - t > 60_000)) ipWindows.delete(key);
  }
}, 5 * 60_000);

// ── Razorpay signature verifier ────────────────────────────────────
import crypto from 'crypto';

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ── Machine HMAC signature for dispense endpoint ───────────────────
export function signDispenseRequest(payload: string): string {
  return crypto
    .createHmac('sha256', process.env.MACHINE_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
}

// ── Generic API response helpers ──────────────────────────────────
export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

// ── Get real IP from various proxy headers ────────────────────────
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0'
  );
}
