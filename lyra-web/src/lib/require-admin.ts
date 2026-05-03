// ================================================================
//  requireAdmin — shared admin auth guard for API route handlers
//  Returns a Response error if not authenticated, null if ok.
// ================================================================
import { NextRequest } from 'next/server';
import { verifyAdminToken, ADMIN_COOKIE } from '@/lib/auth';
import { apiError } from '@/lib/utils';
import { cookies } from 'next/headers';

export async function requireAdmin(req: NextRequest): Promise<Response | null> {
  // Support both cookie (browser) and Authorization header (programmatic)
  let token: string | undefined;

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ADMIN_COOKIE)?.value;
  if (cookieToken) {
    token = cookieToken;
  } else {
    const authHeader = req.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return apiError('Unauthorized', 401);

  try {
    await verifyAdminToken(token);
    return null; // authorized
  } catch {
    return apiError('Invalid or expired token', 401);
  }
}
