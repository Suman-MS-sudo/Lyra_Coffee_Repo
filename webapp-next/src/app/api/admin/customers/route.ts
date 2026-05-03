import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createCustomerSchema } from '@/lib/validators/schemas';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { apiError } from '@/lib/utils/security';
import crypto from 'crypto';

// ── GET /api/admin/customers ────────────────────────────────────
export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { data, error } = await supabaseAdmin
    .from('coffee_customers')
    .select('id, name, email, company, is_active, last_login_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return apiError('Failed to fetch customers', 500);
  return Response.json({ data: data ?? [] });
}

// ── POST /api/admin/customers ───────────────────────────────────
export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await req.json(); }
  catch { return apiError('Invalid JSON', 400); }

  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors[0]?.message ?? 'Validation failed', 422);
  }

  const { name, email, password, company } = parsed.data;

  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  const { data, error } = await supabaseAdmin
    .from('coffee_customers')
    .insert({
      name,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      company: company ?? null,
    })
    .select('id, name, email, company, is_active, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return apiError('Email already in use', 409);
    return apiError('Failed to create customer', 500);
  }

  return Response.json({ data }, { status: 201 });
}
