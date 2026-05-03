import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createMachineSchema, updateMachineSchema, paginationSchema } from '@/lib/validators/schemas';
import { generateMachineApiKey, apiError } from '@/lib/utils/security';
import { requireAdmin } from '@/lib/utils/admin-auth';

// ── GET /api/admin/machines?page=1&per_page=20 ──────────────────
export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const { page, per_page } = paginationSchema.parse({
    page:     searchParams.get('page'),
    per_page: searchParams.get('per_page'),
  });

  const from = (page - 1) * per_page;
  const to   = from + per_page - 1;

  const { data, count, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return apiError('Failed to fetch machines', 500);

  return Response.json({ data, total: count ?? 0, page, per_page });
}

// ── POST /api/admin/machines ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = createMachineSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  // Generate API key for the machine
  const { key, hash } = generateMachineApiKey();

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .insert({
      name:         parsed.data.name,
      location:     parsed.data.location ?? null,
      status:       parsed.data.status,
      api_key_hash: hash,
    })
    .select('id, name, location, status, created_at')
    .single();

  if (error) {
    console.error('[machines/POST]', error);
    return apiError('Failed to create machine', 500);
  }

  // Return the plaintext key ONCE — it cannot be retrieved again
  return Response.json({ ...data, api_key: key }, { status: 201 });
}

// ── PATCH /api/admin/machines ────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = updateMachineSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }
  const { id, ...updates } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .update(updates)
    .eq('id', id)
    .select('id, name, location, status, updated_at')
    .single();

  if (error) return apiError('Failed to update machine', 500);
  return Response.json(data);
}

// ── DELETE /api/admin/machines?id=<uuid> ─────────────────────────
export async function DELETE(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return apiError('Missing id', 400);

  // Check for existing orders before deleting
  const { count } = await supabaseAdmin
    .from('coffee_orders')
    .select('id', { count: 'exact', head: true })
    .eq('machine_id', id);

  if ((count ?? 0) > 0) {
    // Soft-delete: set to inactive rather than removing a machine with history
    await supabaseAdmin.from('coffee_machines').update({ status: 'inactive' }).eq('id', id);
    return Response.json({ status: 'deactivated' });
  }

  await supabaseAdmin.from('coffee_machines').delete().eq('id', id);
  return Response.json({ status: 'deleted' });
}
