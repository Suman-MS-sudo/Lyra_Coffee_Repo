import { NextRequest } from 'next/server';
import { verifyCustomerToken, type CustomerJwtPayload } from '@/lib/utils/jwt';
import { apiError } from '@/lib/utils/security';

export async function requireCustomer(
  req: NextRequest
): Promise<{ error: Response } | { payload: CustomerJwtPayload }> {
  const cookie = req.cookies.get('customer_token');
  if (!cookie?.value) {
    return { error: apiError('Unauthorized', 401) as Response };
  }
  try {
    const payload = await verifyCustomerToken(cookie.value);
    return { payload };
  } catch {
    return { error: apiError('Session expired. Please log in again.', 401) as Response };
  }
}
