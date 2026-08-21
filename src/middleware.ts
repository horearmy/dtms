import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { ROUTE_FEATURE_MAP } from '@/lib/billing';

const COOKIE_NAME = 'dtms_token';
const CSRF_COOKIE = 'dtms_csrf';
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required');
}
const secret = new TextEncoder().encode(AUTH_SECRET);

const RATE_WINDOW_MS = 60_000;
const RATE_API_LIMIT = Number(process.env.RATE_API_LIMIT) || 300;
const RATE_LOGIN_LIMIT = Math.min(Number(process.env.RATE_LOGIN_LIMIT) || 10, process.env.NODE_ENV === 'production' ? 30 : 9999);
const RATE_GPS_LIMIT = Number(process.env.RATE_GPS_LIMIT) || 60;
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

function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isMutationMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function verifyCsrf(req: NextRequest): boolean {
  const token = req.headers.get('x-csrf-token');
  const cookie = req.cookies.get(CSRF_COOKIE)?.value;
  if (!token || !cookie) return false;
  if (token.length !== cookie.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ cookie.charCodeAt(i);
  }
  return result === 0;
}

function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), interest-cohort=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.google.com https://*.basemaps.cartocdn.com",
    "media-src 'self' blob:",
    "connect-src 'self' https://tile.openstreetmap.org https://*.openstreetmap.org https://nominatim.openstreetmap.org https://*.google.com https://*.basemaps.cartocdn.com https://router.project-osrm.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '));
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  const PUBLIC_PATHS = ['/', '/login', '/tracking', '/features', '/pricing', '/demo-request', '/track'];
  const isPublicPage = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  const isTrackingApi = pathname.startsWith('/api/tracking/');
  const isTrackingIngest = pathname === '/api/tracking/ingest';
  const isDemoRequestApi = pathname === '/api/demo-request';
  const isTenantListApi = pathname === '/api/auth/tenants';
  const isPublic = isPublicPage || isTrackingApi || isDemoRequestApi || isTenantListApi;

  if (pathname.startsWith('/api/')) {
    if (isPublic) {
      const res = NextResponse.next();
      return addSecurityHeaders(res);
    }

    const isLogin = pathname === '/api/auth/login' || pathname.startsWith('/api/auth/two-factor');
    const isGps = pathname === '/api/gps' && req.method === 'POST';
    const limit = isLogin ? RATE_LOGIN_LIMIT : isGps ? RATE_GPS_LIMIT : RATE_API_LIMIT;
    const key = `${isLogin ? 'login' : isGps ? 'gps' : 'api'}:${ip}`;
    const rl = rateLimit(key, limit);
    if (!rl.allowed) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      ));
    }

    if (isMutationMethod(req.method)) {
      const isPublicAuth = pathname === '/api/auth/login' || pathname.startsWith('/api/auth/two-factor') || pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password';
      const authHeader = req.headers.get('authorization');
      const isApiKeyRequest = authHeader && authHeader.toLowerCase().startsWith('bearer dtms_');
      if (!isPublicAuth && !isApiKeyRequest && !verifyCsrf(req)) {
        return addSecurityHeaders(NextResponse.json(
          { error: 'CSRF token tidak valid' },
          { status: 403 }
        ));
      }
    }

    const res = NextResponse.next();
    if (!req.cookies.get(CSRF_COOKIE)) {
      res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }
    return addSecurityHeaders(res);
  }

  if (isPublicPage) {
    const res = NextResponse.next();
    if (!req.cookies.get(CSRF_COOKIE)) {
      res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }
    return addSecurityHeaders(res);
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization');
  const isApiKeyRequest = authHeader && authHeader.toLowerCase().startsWith('bearer dtms_');

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';

  if (!token && !isApiKeyRequest) return NextResponse.redirect(loginUrl);

  if (isApiKeyRequest) {
    const res = NextResponse.next();
    return addSecurityHeaders(res);
  }

  const isDriverRoute = pathname === '/driver' || pathname.startsWith('/driver/');
  const isOpsDash = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isUsersRoute = pathname === '/users' || pathname.startsWith('/users/');
  const isSuperAdminOnlyRoute = pathname === '/tenants' || pathname.startsWith('/tenants/') || pathname === '/demo-requests' || pathname.startsWith('/demo-requests/') || pathname === '/audit' || pathname.startsWith('/audit/') || pathname === '/account' || pathname.startsWith('/account/') || pathname === '/komunikasi' || pathname.startsWith('/komunikasi/') || pathname === '/global-control-tower' || pathname.startsWith('/global-control-tower/') || pathname === '/security' || pathname.startsWith('/security/') || pathname === '/hierarchy' || pathname.startsWith('/hierarchy/') || pathname === '/tenant-onboarding' || pathname.startsWith('/tenant-onboarding/') || pathname === '/tenant-health' || pathname.startsWith('/tenant-health/');
  const isOperationalRoute = !isSuperAdminOnlyRoute && !isDriverRoute && pathname !== '/tracking' && pathname !== '/login' && !pathname.startsWith('/tracking/') && !pathname.startsWith('/api/') && pathname !== '/billing' && !pathname.startsWith('/billing/');

  try {
    const { payload } = await jwtVerify(token!, secret);
    const role = payload.role as string;
    if (role === 'SUPER_ADMIN' && isOperationalRoute) {
      const url = req.nextUrl.clone();
      url.pathname = '/tenants';
      return NextResponse.redirect(url);
    }
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

    // Feature gating — check if plan includes the feature for this route
    if (role !== 'SUPER_ADMIN' && !isDriverRoute && !pathname.startsWith('/api/')) {
      const planFeatures = payload.planFeatures as string[] | undefined;
      const tenantPlan = payload.plan as string | undefined;
      if (planFeatures && tenantPlan && tenantPlan !== 'ENTERPRISE') {
        for (const [routePrefix, featureCode] of Object.entries(ROUTE_FEATURE_MAP)) {
          if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
            if (!planFeatures.includes(featureCode)) {
              const url = req.nextUrl.clone();
              url.pathname = '/billing';
              url.searchParams.set('upgrade', featureCode);
              return NextResponse.redirect(url);
            }
            break;
          }
        }
      }
    }

    const res = NextResponse.next();
    if (!req.cookies.get(CSRF_COOKIE)) {
      res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }
    // Pass plan info to client
    if (payload.plan) res.headers.set('X-Tenant-Plan', payload.plan as string);
    if (payload.planFeatures) res.headers.set('X-Plan-Features', JSON.stringify(payload.planFeatures));
    return addSecurityHeaders(res);
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/control-tower/:path*',
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
    '/customer/:path*',
    '/settings/:path*',
    '/tenants/:path*',
    '/warehouse/:path*',
    '/dispatch/:path*',
    '/exceptions/:path*',
    '/sla/:path*',
    '/demo-requests/:path*',
    '/health/:path*',
    '/billing/:path*',
    '/integrations/:path*',
    '/analytics/:path*',
    '/branches/:path*',
    '/departments/:path*',
    '/hubs/:path*',
    '/hierarchy/:path*',
    '/notifications/:path*',
    '/organizations/:path*',
    '/regions/:path*',
    '/roles/:path*',
    '/warehouses/:path*',
    '/komunikasi/:path*',
    '/global-control-tower/:path*',
    '/tenant-health/:path*',
    '/tenant-onboarding/:path*',
    '/security/:path*',
  ],
};
