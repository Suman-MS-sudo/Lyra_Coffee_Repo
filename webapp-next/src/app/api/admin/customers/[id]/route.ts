import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema, updateCustomerSchema } from '@/lib/validators/schemas';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { apiError } from '@/lib/utils/security';

// ── PATCH /api/admin/customers/[id] ────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid customer ID', 400);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const validated = updateCustomerSchema.safeParse(body);
  if (!validated.success) {
    return apiError(validated.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  const { password, email, ...rest } = validated.data;

  const updates: Record<string, unknown> = { ...rest };
  if (email) updates.email = email.toLowerCase();
  if (password) {
    updates.password_hash = crypto.createHash('sha256').update(password).digest('hex');
  }

  if (Object.keys(updates).length === 0) return apiError('Nothing to update', 422);

  const { data, error } = await supabaseAdmin
    .from('coffee_customers')
    .update(updates)
    .eq('id', parsed.data)
    .select('id, name, email, company, is_active, last_login_at, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return apiError('Email already in use', 409);
    return apiError('Failed to update customer', 500);
  }
  return Response.json({ data });
}

// ── DELETE /api/admin/customers/[id] ───────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid customer ID', 400);

  const { error } = await supabaseAdmin
    .from('coffee_customers')
    .delete()
    .eq('id', parsed.data);

  if (error) return apiError('Failed to delete customer', 500);
  return Response.json({ ok: true });
}
