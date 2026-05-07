import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import { apiError } from '@/lib/utils/security';

// Both key fields optional — either both present, both null, or both absent.
// webhook_secret is always independent.
const settingsSchema = z.object({
  razorpay_key_id:         z.string().regex(/^rzp_(live|test)_/, 'Key ID must start with rzp_live_ or rzp_test_').max(100).nullable().optional(),
  razorpay_key_secret:     z.string().min(1).max(200).nullable().optional(),
  razorpay_webhook_secret: z.string().min(1).max(200).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) return apiError('Unauthorized', 401);

  let customerId: string;
  try {
    const payload = await verifyCustomerToken(token);
    customerId = payload.sub;
  } catch {
    return apiError('Invalid session', 401);
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);

  const { razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret } = parsed.data;

  // Key ID and secret must move together
  const hasKeyId     = razorpay_key_id     !== undefined;
  const hasKeySecret = razorpay_key_secret !== undefined;
  if (hasKeyId !== hasKeySecret) {
    return apiError('Provide both Key ID and Key Secret together, or omit both', 422);
  }
  if (hasKeyId && hasKeySecret) {
    const bothSet   = razorpay_key_id   !== null && razorpay_key_secret !== null;
    const bothClear = razorpay_key_id   === null && razorpay_key_secret === null;
    if (!bothSet && !bothClear) {
      return apiError('Provide both Key ID and Key Secret, or clear both', 422);
    }
  }

  // Build update object from whichever fields were sent
  const updates: Record<string, unknown> = {};
  if (hasKeyId)                         updates.razorpay_key_id     = razorpay_key_id;
  if (hasKeySecret)                     updates.razorpay_key_secret = razorpay_key_secret;
  if (razorpay_webhook_secret !== undefined) updates.razorpay_webhook_secret = razorpay_webhook_secret;

  if (Object.keys(updates).length === 0) return apiError('No fields to update', 422);

  const { error } = await supabaseAdmin
    .from('coffee_customers')
    .update(updates)
    .eq('id', customerId);

  if (error) {
    console.error('[customer/settings] update error:', error);
    return apiError('Failed to save settings', 500);
  }

  return Response.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) return apiError('Unauthorized', 401);

  let customerId: string;
  try {
    const payload = await verifyCustomerToken(token);
    customerId = payload.sub;
  } catch {
    return apiError('Invalid session', 401);
  }

  const { data, error } = await supabaseAdmin
    .from('coffee_customers')
    .select('id, razorpay_key_id, razorpay_webhook_secret')   // never return secrets to client
    .eq('id', customerId)
    .single();

  if (error || !data) return apiError('Not found', 404);

  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`).replace(/\/$/, '');

  return Response.json({
    razorpay_key_id:    data.razorpay_key_id,
    has_webhook_secret: !!data.razorpay_webhook_secret,
    webhook_url:        `${appBase}/api/payment/webhook/${data.id}`,
  });
}
