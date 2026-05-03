// ================================================================
//  GET  /api/admin/machines        — list all machines
//  POST /api/admin/machines        — add a machine
// ================================================================
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { addMachineSchema } from '@/lib/validation';
import { apiError, apiOk } from '@/lib/utils';
import { requireAdmin } from '@/lib/require-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status, api_key, last_ping, created_at')
    .order('created_at', { ascending: false });

  if (error) return apiError('Failed to fetch machines', 500);
  return apiOk(data);
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON'); }

  const parsed = addMachineSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Validation error');

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .insert({ name: parsed.data.name, location: parsed.data.location ?? null })
    .select('id, name, location, status, api_key, api_secret')
    .single();

  if (error || !data) return apiError('Failed to create machine', 500);
  return apiOk(data, 201);
}
