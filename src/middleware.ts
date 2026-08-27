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
  // Ambil hop paling kanan dari X-Forwarded-For (ditambahkan proxy terpercaya kita),
  // bukan yang pertama (dapat dipalsukan klien) — konsisten dengan lib/security.
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.headers.get('x-real-ip') || 'local';
}

// Upstash Redis opsional — jika env diset, limit dibagi antar-instance (edge-safe, berbasis fetch)
let redisClient: { incr(key: string): Promise<number>; pexpire(key: string, ms: number): Promise<unknown> } | null | undefined;
async function getRedis() {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  try {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({ url, token }) as unknown as NonNullable<typeof redisClient>;
  } catch {
    redisClient = null;
  }
  return redisClient;
}

async function rateLimit(key: string, limit: number): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const now = Date.now();
  const redis = await getRedis();
  if (redis) {
    try {
      const rk = `rl:mw:${key}`;
      const count = await redis.incr(rk);
      if (count === 1) await redis.pexpire(rk, RATE_WINDOW_MS);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSec: Math.max(1, Math.ceil(RATE_WINDOW_MS / 1000)),
      };
    } catch {
      // Redis gagal → jatuh ke memori lokal
    }
  }
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
  const scriptSources = process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
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
    scriptSources,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.google.com https://*.basemaps.cartocdn.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "connect-src 'self' https://tile.openstreetmap.org https://*.openstreetmap.org https://nominatim.openstreetmap.org https://*.google.com https://*.basemaps.cartocdn.com https://router.project-osrm.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; '));
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = clientIp(req);

  const PUBLIC_PATHS = ['/', '/login', '/tracking', '/features', '/pricing', '/demo-request', '/track', '/admin/secure-login'];
  const isPublicPage = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  const isTrackingApi = pathname.startsWith('/api/tracking/');
  const isTrackingIngest = pathname === '/api/tracking/ingest';
  const isDemoRequestApi = pathname === '/api/demo-request';
  const isTenantListApi = pathname === '/api/auth/tenants';
  const isSuperadminLoginApi = pathname === '/api/auth/superadmin-login';
  const isPublic = isPublicPage || isTrackingApi || isDemoRequestApi || isTenantListApi || isSuperadminLoginApi;

  if (pathname.startsWith('/api/')) {
    // Teruskan HTTP method ke route handler agar verifikasi scope API key bisa terpusat
    const fwdHeaders = new Headers(req.headers);
    fwdHeaders.set('x-dtms-method', req.method);

    if (isMutationMethod(req.method)) {
      const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
      // Upload memiliki validasi ukuran sendiri (10 MB) setelah multipart
      // parsing; beri sedikit ruang untuk overhead multipart boundary.
      const isUpload = pathname === '/api/upload';
      const MAX_BODY_BYTES = isUpload ? 11 * 1_048_576 : 1_048_576;
      if (contentLength > MAX_BODY_BYTES) {
        return addSecurityHeaders(NextResponse.json(
          { error: `Request body terlalu besar. Maks ${isUpload ? '11MB' : '1MB'}.` },
          { status: 413 }
        ));
      }
    }

    if (isPublic) {
      const res = NextResponse.next({ request: { headers: fwdHeaders } });
      return addSecurityHeaders(res);
    }

    const isLogin = pathname === '/api/auth/login' || pathname.startsWith('/api/auth/two-factor');
    const isGps = pathname === '/api/gps' && req.method === 'POST';
    const limit = isLogin ? RATE_LOGIN_LIMIT : isGps ? RATE_GPS_LIMIT : RATE_API_LIMIT;
    const key = `${isLogin ? 'login' : isGps ? 'gps' : 'api'}:${ip}`;
    const rl = await rateLimit(key, limit);
    if (!rl.allowed) {
      return addSecurityHeaders(NextResponse.json(
        { error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      ));
    }

    if (isMutationMethod(req.method)) {
      const isPublicAuth = pathname === '/api/auth/login' || pathname.startsWith('/api/auth/two-factor') || pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password' || pathname === '/api/auth/logout';
      const authHeader = req.headers.get('authorization');
      const isApiKeyRequest = authHeader && authHeader.toLowerCase().startsWith('bearer dtms_');
      if (!isPublicAuth && !isApiKeyRequest && !verifyCsrf(req)) {
        return addSecurityHeaders(NextResponse.json(
          { error: 'CSRF token tidak valid' },
          { status: 403 }
        ));
      }

      // Paksa ganti password: blokir semua mutasi kecuali change-password & logout
      const MCP_ALLOWED = ['/api/auth/change-password', '/api/auth/logout'];
      const sessToken = req.cookies.get(COOKIE_NAME)?.value;
      if (!isApiKeyRequest && sessToken && !MCP_ALLOWED.includes(pathname)) {
        try {
          const { payload } = await jwtVerify(sessToken, secret);
          if (payload.mcp === true) {
            return addSecurityHeaders(NextResponse.json(
              { error: 'Anda wajib mengganti password terlebih dahulu', mustChangePassword: true },
              { status: 403 }
            ));
          }
        } catch { /* token tidak valid — biarkan route menolak */ }
      }
    }

    const res = NextResponse.next({ request: { headers: fwdHeaders } });
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

  // Sesi reguler (dtms_token) atau sesi Super Admin terpisah (dtms_sa_token).
  // Verifikasi penuh (fingerprint, status user) dilakukan di server via getSession().
  const token = req.cookies.get(COOKIE_NAME)?.value
    ?? req.cookies.get('dtms_sa_token')?.value;
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
  const isSuperAdminOnlyRoute = pathname === '/tenants' || pathname.startsWith('/tenants/') || pathname === '/demo-requests' || pathname.startsWith('/demo-requests/') || pathname === '/audit' || pathname.startsWith('/audit/') || pathname === '/account' || pathname.startsWith('/account/') || pathname === '/komunikasi' || pathname.startsWith('/komunikasi/') || pathname === '/global-control-tower' || pathname.startsWith('/global-control-tower/') || pathname === '/security' || pathname.startsWith('/security/') || pathname === '/hierarchy' || pathname.startsWith('/hierarchy/') || pathname === '/tenant-onboarding' || pathname.startsWith('/tenant-onboarding/') || pathname === '/tenant-health' || pathname.startsWith('/tenant-health/') || pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/shipments' || pathname.startsWith('/shipments/') || pathname === '/drivers' || pathname.startsWith('/drivers/') || pathname === '/platform-intelligence' || pathname.startsWith('/platform-intelligence/');
  const isOperationalRoute = !isSuperAdminOnlyRoute && !isDriverRoute && pathname !== '/tracking' && pathname !== '/login' && !pathname.startsWith('/tracking/') && !pathname.startsWith('/api/') && pathname !== '/billing' && !pathname.startsWith('/billing/');

  try {
    const { payload } = await jwtVerify(token!, secret);
    const role = payload.role as string;

    // Wajib ganti password: alihkan ke halaman ubah password sampai selesai
    if (payload.mcp === true && !pathname.startsWith('/account')) {
      const url = req.nextUrl.clone();
      url.pathname = '/account/password';
      url.searchParams.set('first', '1');
      return NextResponse.redirect(url);
    }

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
