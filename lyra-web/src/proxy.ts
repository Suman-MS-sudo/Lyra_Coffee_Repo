// ================================================================
//  Next.js Proxy (was: middleware) — Next.js 16+
//  - Protects /admin/* routes
//  - Adds security headers to all responses
// ================================================================
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ADMIN_COOKIE = 'lyra_admin_token';

  // ── Admin route protection ─────────────────────────────────────
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  // ── Security headers ──────────────────────────────────────────
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co https://api.razorpay.com",
      "frame-src https://api.razorpay.com",
      "font-src 'self'",
    ].join('; ')
  );

  return response;
}
