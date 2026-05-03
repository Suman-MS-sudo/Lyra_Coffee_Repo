export async function POST() {
  const resp = Response.json({ ok: true });
  resp.headers.set(
    'Set-Cookie',
    'customer_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  );
  return resp;
}
