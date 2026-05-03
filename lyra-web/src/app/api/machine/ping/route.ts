// ================================================================
//  POST /api/machine/ping — machine heartbeat
//  GET  /api/machine/ping — health check
//  Machines call this every 60s to report they're online.
//  Authenticated via api_key in Authorization header.
// ================================================================
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { uuidSchema } from '@/lib/validation';
import { apiError, apiOk } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const apiKey = authHeader.replace('Bearer ', '').trim();

  if (!apiKey) return apiError('Missing API key', 401);

  const { data: machine } = await supabaseAdmin
    .from('coffee_machines')
    .select('id')
    .eq('api_key', apiKey)
    .single();

  if (!machine) return apiError('Invalid API key', 401);

  await supabaseAdmin
    .from('coffee_machines')
    .update({ last_ping: new Date().toISOString() })
    .eq('id', machine.id);

  return apiOk({ pong: true, ts: new Date().toISOString() });
}

export async function GET() {
  return apiOk({ status: 'ok' });
}
