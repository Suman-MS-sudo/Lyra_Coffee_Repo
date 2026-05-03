import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators/schemas';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { apiError } from '@/lib/utils/security';
import { z } from 'zod';

const patchSchema = z.object({
  status:      z.enum(['active', 'inactive', 'maintenance']).optional(),
  name:        z.string().min(1).max(120).trim().optional(),
  location:    z.string().max(255).trim().optional(),
  customer_id: z.union([uuidSchema, z.null()]).optional(),
});

// ── PATCH /api/admin/machines/[id] ─────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid machine ID', 400);

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const bodyParsed = patchSchema.safeParse(body);
  if (!bodyParsed.success) {
    return apiError(bodyParsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .update(bodyParsed.data)
    .eq('id', parsed.data)
    .select('id, name, location, status, customer_id, updated_at')
    .single();

  if (error) return apiError('Failed to update machine', 500);
  return Response.json(data);
}

// ── DELETE /api/admin/machines/[id] ────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const parsed = uuidSchema.safeParse(params.id);
  if (!parsed.success) return apiError('Invalid machine ID', 400);

  const { error } = await supabaseAdmin
    .from('coffee_machines')
    .delete()
    .eq('id', parsed.data);

  if (error) return apiError('Failed to delete machine', 500);
  return Response.json({ ok: true });
}
