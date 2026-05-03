// POST /api/admin/auth/logout — clears the JWT cookie
import { apiOk } from '@/lib/utils';
import { ADMIN_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return apiOk({ ok: true });
}
