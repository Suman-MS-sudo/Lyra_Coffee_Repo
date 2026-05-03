import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import { verifyCustomerToken } from '@/lib/utils/jwt';
import { apiError } from '@/lib/utils/security';

// Max ₹1000 per drink (sanity cap; UI enforces this too)
const MAX_PAISE = 100_000;

const pricingSchema = z.object({
  is_free: z.boolean(),
  price_coffee_paise: z.union([
    z.number().int().min(0).max(MAX_PAISE),
    z.null(),
  ]),
  price_tea_paise: z.union([
    z.number().int().min(0).max(MAX_PAISE),
    z.null(),
  ]),
});

async function authedCustomerId(): Promise<string | null> {
  const token = (await cookies()).get('customer_token')?.value;
  if (!token) return null;
  try {
    const payload = await verifyCustomerToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

// PATCH /api/customer/machines/[id]/pricing
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const customerId = await authedCustomerId();
  if (!customerId) return apiError('Unauthorized', 401);

  const idParse = uuidSchema.safeParse(params.id);
  if (!idParse.success) return apiError('Invalid machine ID', 400);
  const machineId = idParse.data;

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = pricingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  // Verify ownership
  const { data: machine, error: mErr } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, customer_id')
    .eq('id', machineId)
    .single();

  if (mErr || !machine)                    return apiError('Machine not found', 404);
  if (machine.customer_id !== customerId)  return apiError('Forbidden', 403);

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .update({
      is_free:            parsed.data.is_free,
      price_coffee_paise: parsed.data.price_coffee_paise,
      price_tea_paise:    parsed.data.price_tea_paise,
    })
    .eq('id', machineId)
    .select('id, is_free, price_coffee_paise, price_tea_paise, updated_at')
    .single();

  if (error) {
    console.error('[customer/pricing] update error:', error);
    return apiError('Failed to update pricing', 500);
  }

  return Response.json(data);
}
