import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'dtms_token';
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dtms-dev-secret-change-me'
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';

  if (!token) return NextResponse.redirect(loginUrl);

  const isDriverRoute = pathname === '/driver' || pathname.startsWith('/driver/');
  const isOpsDash = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;
    if (isDriverRoute && role !== 'DRIVER') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    if (isOpsDash && role === 'DRIVER') {
      const url = req.nextUrl.clone();
      url.pathname = '/driver';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/shipments/:path*',
    '/drivers/:path*',
    '/vehicles/:path*',
    '/customers/:path*',
    '/map/:path*',
    '/reports/:path*',
    '/audit/:path*',
    '/geofences/:path*',
    '/driver/:path*',
  ],
};