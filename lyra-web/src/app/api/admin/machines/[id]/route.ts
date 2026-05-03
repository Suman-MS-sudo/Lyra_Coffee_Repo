// ================================================================
//  PATCH /api/admin/machines/[id]   — update name/location/status
//  DELETE /api/admin/machines/[id]  — remove machine
// ================================================================
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { updateMachineSchema, uuidSchema } from '@/lib/validation';
import { apiError, apiOk } from '@/lib/utils';
import { requireAdmin } from '@/lib/require-admin';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError('Invalid machine ID');

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON'); }

  const parsed = updateMachineSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error');

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .update(parsed.data)
    .eq('id', id)
    .select('id, name, location, status')
    .single();

  if (error || !data) return apiError('Machine not found or update failed', 404);
  return apiOk(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError('Invalid machine ID');

  const { error } = await supabaseAdmin
    .from('coffee_machines')
    .delete()
    .eq('id', id);

  if (error) return apiError('Failed to delete machine', 500);
  return apiOk({ deleted: true });
}
