import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'dtms_token';
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required');
}
const secret = new TextEncoder().encode(AUTH_SECRET);

const RATE_WINDOW_MS = 60_000;
const RATE_API_LIMIT = 300;
const RATE_LOGIN_LIMIT = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}, RATE_WINDOW_MS).unref?.();

function clientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-host') || 'local';
}

function rateLimit(key: string, limit: number): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  b.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterSec };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  const PUBLIC_PATHS = ['/', '/login', '/tracking', '/features', '/pricing', '/demo-request'];
  const isPublicPage = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  const isTrackingApi = pathname.startsWith('/api/tracking/');
  const isDemoRequestApi = pathname === '/api/demo-request';
  const isTenantListApi = pathname === '/api/auth/tenants';
  const isPublic = isPublicPage || isTrackingApi || isDemoRequestApi || isTenantListApi;

  if (pathname.startsWith('/api/')) {
    if (isPublic) return NextResponse.next();
    const isLogin = pathname === '/api/auth/login' || pathname.startsWith('/api/auth/two-factor');
    const limit = isLogin ? RATE_LOGIN_LIMIT : RATE_API_LIMIT;
    const key = `${isLogin ? 'login' : 'api'}:${ip}`;
    const rl = rateLimit(key, limit);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    return NextResponse.next();
  }

  if (isPublicPage) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';

  if (!token) return NextResponse.redirect(loginUrl);

  const isDriverRoute = pathname === '/driver' || pathname.startsWith('/driver/');
  const isOpsDash = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isUsersRoute = pathname === '/users' || pathname.startsWith('/users/');

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
    if (isUsersRoute && role !== 'SUPER_ADMIN' && role !== 'ADMIN_OPERASIONAL') {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/shipments/:path*',
    '/drivers/:path*',
    '/vehicles/:path*',
    '/customers/:path*',
    '/map/:path*',
    '/users/:path*',
    '/reports/:path*',
    '/audit/:path*',
    '/geofences/:path*',
    '/account/:path*',
    '/driver/:path*',
    '/settings/:path*',
    '/tenants/:path*',
  ],
};
