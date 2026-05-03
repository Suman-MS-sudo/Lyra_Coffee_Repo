// GET /api/machines/[id] — public endpoint to read a single machine's public info
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { uuidSchema } from '@/lib/validation';
import { apiError, apiOk } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return apiError('Invalid machine ID');

  const { data, error } = await supabaseAdmin
    .from('coffee_machines')
    .select('id, name, location, status')
    .eq('id', id)
    .single();

  if (error || !data) return apiError('Machine not found', 404);
  return apiOk(data);
}
