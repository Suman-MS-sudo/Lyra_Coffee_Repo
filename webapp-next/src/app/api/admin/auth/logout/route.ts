export async function POST() {
  const resp = Response.json({ status: 'logged_out' });
  resp.headers.set(
    'Set-Cookie',
    'admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  );
  return resp;
}
