// ================================================================
//  JWT utilities for admin authentication
//  Uses jose (Edge-compatible, no Node.js crypto dependency)
// ================================================================
import { SignJWT, jwtVerify } from 'jose';
import type { AdminTokenPayload } from '@/types';

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'fallback-dev-secret-change-in-production-32ch'
  );
}

const EXPIRY = '8h';

export async function signAdminToken(
  payload: Omit<AdminTokenPayload, 'iat' | 'exp'>
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecretKey());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    algorithms: ['HS256'],
  });
  return payload as unknown as AdminTokenPayload;
}

// ── Cookie helpers ─────────────────────────────────────────────────
export const ADMIN_COOKIE = 'lyra_admin_token';

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
