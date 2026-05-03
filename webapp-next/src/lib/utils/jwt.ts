import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';

// ── Admin JWT ────────────────────────────────────────────────────
const adminSecret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? '');
const ADMIN_ISSUER = 'lyra-coffee-admin';

export interface AdminJwtPayload {
  sub:   string;   // admin ID
  email: string;
  name:  string;
}

export async function signAdminToken(payload: AdminJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ADMIN_ISSUER)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(adminSecret);
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload> {
  const { payload } = await jwtVerify(token, adminSecret, { issuer: ADMIN_ISSUER });
  return payload as unknown as AdminJwtPayload;
}

// ── Customer JWT ─────────────────────────────────────────────────
const customerSecret = new TextEncoder().encode(
  process.env.CUSTOMER_JWT_SECRET ?? process.env.ADMIN_JWT_SECRET ?? ''
);
const CUSTOMER_ISSUER = 'lyra-coffee-customer';

export interface CustomerJwtPayload {
  sub:   string;   // customer ID
  email: string;
  name:  string;
}

export async function signCustomerToken(payload: CustomerJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(CUSTOMER_ISSUER)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(customerSecret);
}

export async function verifyCustomerToken(token: string): Promise<CustomerJwtPayload> {
  const { payload } = await jwtVerify(token, customerSecret, { issuer: CUSTOMER_ISSUER });
  return payload as unknown as CustomerJwtPayload;
}
