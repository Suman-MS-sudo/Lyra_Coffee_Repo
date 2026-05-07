import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { supabaseAdmin } from '@/lib/supabase/server';
import { apiError } from '@/lib/utils/security';

const settingsSchema = z.object({
  razorpay_key_id:     z.string().regex(/^rzp_(live|test)_/, 'Key ID must start with rzp_live_ or rzp_test_').max(100).nullable(),
  razorpay_key_secret: z.string().min(1).max(200).nullable(),
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

  const { razorpay_key_id, razorpay_key_secret } = parsed.data;

  // Both must be provided together or both cleared together
  if ((razorpay_key_id && !razorpay_key_secret) || (!razorpay_key_id && razorpay_key_secret)) {
    return apiError('Provide both Key ID and Key Secret, or clear both', 422);
  }

  const { error } = await supabaseAdmin
    .from('coffee_customers')
    .update({ razorpay_key_id, razorpay_key_secret })
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
    .select('razorpay_key_id')   // never return the secret to the client
    .eq('id', customerId)
    .single();

  if (error || !data) return apiError('Not found', 404);

  return Response.json({ razorpay_key_id: data.razorpay_key_id });
}
