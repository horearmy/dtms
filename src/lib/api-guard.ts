import { NextRequest, NextResponse } from 'next/server';
import { getSession, type SessionUser } from './auth';
import { tenantStore } from './prisma';
import { resolveAccessScope, hasPermission, type AccessScope } from './access-scope';
import { checkPlanLimit } from './billing';

const tenantBuckets = new Map<string, { count: number; windowStart: number }>();
const TENANT_RATE_WINDOW_MS = 60_000;

function checkTenantRateLimit(tenantId: string, maxRequests: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = tenantBuckets.get(tenantId);
  if (!bucket || now - bucket.windowStart > TENANT_RATE_WINDOW_MS) {
    tenantBuckets.set(tenantId, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSec: 0 };
  }
  bucket.count++;
  if (bucket.count > maxRequests) {
    const retryAfterSec = Math.ceil((bucket.windowStart + TENANT_RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true, retryAfterSec: 0 };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of tenantBuckets) {
    if (now - bucket.windowStart > TENANT_RATE_WINDOW_MS * 2) {
      tenantBuckets.delete(key);
    }
  }
}, 120_000);

export async function checkTenantThrottle(tenantId: string | null | undefined, isGps = false): Promise<NextResponse | null> {
  if (!tenantId) return null;
  try {
    const { prisma } = await import('./prisma');
    const rl = await prisma.tenantRateLimit.findUnique({ where: { tenantId } });
    if (!rl) return null;
    if (rl.blocked) {
      return NextResponse.json({ error: 'Tenant ini diblokir dari mengakses API' }, { status: 429 });
    }
    if (!rl.active) return null;
    const max = isGps ? rl.gpsMaxRequests : rl.apiMaxRequests;
    const result = checkTenantRateLimit(tenantId, max);
    if (!result.allowed) {
      return NextResponse.json(
        { error: `Rate limit terlampaui. Maks ${max} request/menit. Silakan coba lagi nanti.` },
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
      );
    }
  } catch {
    // don't block on rate limit check failure
  }
  return null;
}

export async function guard(
  ...roles: string[]
): Promise<{ session: SessionUser | null; error: NextResponse | null }> {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 }) };
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    return { session, error: NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 }) };
  }
  if (session.role !== 'SUPER_ADMIN' && session.tenantId) {
    const throttleError = await checkTenantThrottle(session.tenantId);
    if (throttleError) return { session, error: throttleError };
  }
  return { session, error: null };
}

export async function guardPermission(
  permission: string,
  ...roles: string[]
): Promise<{ session: SessionUser; scope: AccessScope; error: NextResponse | null }> {
  const session = await getSession();
  if (!session) {
    return { session: null as unknown as SessionUser, scope: null as unknown as AccessScope, error: NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 }) };
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    return { session, scope: null as unknown as AccessScope, error: NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 }) };
  }
  if (session.role !== 'SUPER_ADMIN' && session.tenantId) {
    const throttleError = await checkTenantThrottle(session.tenantId);
    if (throttleError) return { session, scope: null as unknown as AccessScope, error: throttleError };
  }
  const scope = await resolveAccessScope(session);
  if (!hasPermission(scope, permission)) {
    return { session, scope, error: NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 }) };
  }
  return { session, scope, error: null };
}

export async function runWithTenant<T>(tenantId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run(tenantId ?? null, fn);
}

type HandlerFn = (req: NextRequest, session: SessionUser) => Promise<NextResponse>;
type HandlerFnWithParams = (req: NextRequest, session: SessionUser, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

export function requireAuth(...roles: string[]) {
  return function wrap(handler: HandlerFn) {
    return async function wrappedHandler(req: NextRequest): Promise<NextResponse> {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
      }
      if (roles.length > 0 && !roles.includes(session.role)) {
        return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 });
      }
      return tenantStore.run(session.tenantId ?? null, () => handler(req, session));
    };
  };
}

export function requireAuthParams(...roles: string[]) {
  return function wrap(handler: HandlerFnWithParams) {
    return async function wrappedHandler(req: NextRequest, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
      }
      if (roles.length > 0 && !roles.includes(session.role)) {
        return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 });
      }
      return tenantStore.run(session.tenantId ?? null, () => handler(req, session, ctx));
    };
  };
}

export function requirePermission(permission: string, ...roles: string[]) {
  return function wrap(handler: HandlerFn) {
    return async function wrappedHandler(req: NextRequest): Promise<NextResponse> {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
      }
      if (roles.length > 0 && !roles.includes(session.role)) {
        return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 });
      }
      const scope = await resolveAccessScope(session);
      if (!hasPermission(scope, permission)) {
        return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 });
      }
      return tenantStore.run(session.tenantId ?? null, () => handler(req, session));
    };
  };
}

export function requirePermissionParams(permission: string, ...roles: string[]) {
  return function wrap(handler: HandlerFnWithParams) {
    return async function wrappedHandler(req: NextRequest, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
      }
      if (roles.length > 0 && !roles.includes(session.role)) {
        return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 });
      }
      const scope = await resolveAccessScope(session);
      if (!hasPermission(scope, permission)) {
        return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 });
      }
      return tenantStore.run(session.tenantId ?? null, () => handler(req, session, ctx));
    };
  };
}

type AuditData = string | { oldData?: unknown; newData?: unknown };

export async function guardPlanLimit(
  session: SessionUser | null,
  resource: 'users' | 'drivers' | 'shipments',
): Promise<NextResponse | null> {
  if (!session?.tenantId || session.role === 'SUPER_ADMIN') return null;
  const result = await checkPlanLimit(session.tenantId, resource);
  if (result.allowed) return null;
  return NextResponse.json(
    {
      error: `Batas ${resource} tercapai (${result.current}/${result.max}). Upgrade plan untuk menambah.`,
      upgrade_required: true,
      current: result.current,
      max: result.max,
    },
    { status: 403 },
  );
}

function json(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return undefined;
  }
}

export async function logAudit(
  session: SessionUser | null,
  action: string,
  module: string,
  data?: AuditData,
  req?: NextRequest
) {
  try {
    const { prisma } = await import('./prisma');
    const oldData = typeof data === 'object' ? json(data.oldData) : undefined;
    const newData = typeof data === 'object' ? json(data.newData) : typeof data === 'string' ? data : undefined;
    await tenantStore.run(session?.tenantId ?? null, async () => {
      await prisma.auditLog.create({
        data: {
          userId: session?.id,
          action,
          module,
          oldData,
          newData,
          ip: req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req?.headers.get('x-real-ip') ?? null,
          method: req?.method ?? null,
          path: req?.nextUrl?.pathname ?? null,
          userAgent: req?.headers.get('user-agent') ?? null,
        },
      });
    });
  } catch {
    // jangan menggagalkan request utama
  }
}
