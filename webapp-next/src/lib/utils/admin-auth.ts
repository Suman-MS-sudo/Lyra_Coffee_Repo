import { NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/utils/jwt';
import { apiError } from '@/lib/utils/security';

/**
 * Extract and verify the admin JWT from the HttpOnly cookie.
 * Returns null if authenticated, or a Response error if not.
 */
export async function requireAdmin(req: NextRequest): Promise<Response | null> {
  const cookie = req.cookies.get('admin_token');
  if (!cookie?.value) {
    return apiError('Unauthorized', 401);
  }
  try {
    await verifyAdminToken(cookie.value);
    return null;
  } catch {
    return apiError('Session expired. Please log in again.', 401);
  }
}
