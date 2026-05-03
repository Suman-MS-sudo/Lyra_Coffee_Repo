import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { apiError } from '@/lib/utils/security';

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

  // Only allow toggling is_active for now
  if (typeof (body as Record<string, unknown>).is_active !== 'boolean') {
    return apiError('Only is_active field can be patched', 422);
  }

  const { data, error } = await supabaseAdmin
    .from('coffee_customers')
    .update({ is_active: (body as { is_active: boolean }).is_active })
    .eq('id', parsed.data)
    .select('id, name, email, is_active')
    .single();

  if (error) return apiError('Failed to update customer', 500);
  return Response.json({ data });
}
