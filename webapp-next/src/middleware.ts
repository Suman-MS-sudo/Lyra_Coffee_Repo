import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, verifyCustomerToken } from '@/lib/utils/jwt';

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/customer/:path*',
    '/api/customer/:path*',
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin routes ──────────────────────────────────────────────
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // Redirect already-authenticated users away from the login page
    if (pathname === '/admin/login') {
      const token = req.cookies.get('admin_token')?.value;
      if (token) {
        try {
          await verifyAdminToken(token);
          return NextResponse.redirect(new URL('/admin', req.url));
        } catch { /* expired — let them see the login page */ }
      }
      return NextResponse.next();
    }
    // Allow logout API unconditionally
    if (
      pathname === '/api/admin/auth/login' ||
      pathname === '/api/admin/auth/logout'
    ) {
      return NextResponse.next();
    }

    const token = req.cookies.get('admin_token')?.value;
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    try {
      await verifyAdminToken(token);
      return NextResponse.next();
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Customer routes ───────────────────────────────────────────
  if (pathname.startsWith('/customer') || pathname.startsWith('/api/customer')) {
    // Redirect already-authenticated users away from the login page
    if (pathname === '/customer/login') {
      const token = req.cookies.get('customer_token')?.value;
      if (token) {
        try {
          await verifyCustomerToken(token);
          return NextResponse.redirect(new URL('/customer', req.url));
        } catch { /* expired — let them see the login page */ }
      }
      return NextResponse.next();
    }
    // Allow logout API unconditionally
    if (
      pathname === '/api/customer/auth/login' ||
      pathname === '/api/customer/auth/logout'
    ) {
      return NextResponse.next();
    }

    const token = req.cookies.get('customer_token')?.value;
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/customer/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    try {
      await verifyCustomerToken(token);
      return NextResponse.next();
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Session expired' }, { status: 401 });
      }
      const loginUrl = new URL('/customer/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
