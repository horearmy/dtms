import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { getTenantFeatures } from './billing';
import crypto from 'crypto';

export const COOKIE_NAME = 'dtms_token';

if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required. Set it in .env or your hosting platform.');
}
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: string;
  tenantId: string | null;
  branchId: string | null;
  plan?: string;
  planFeatures?: string[];
};

export async function signToken(user: SessionUser & { pwdVersion?: number }) {
  // Fetch plan features for tenant
  let planFeatures: string[] = [];
  let plan = 'FREE';
  if (user.tenantId) {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { plan: true } });
      plan = tenant?.plan || 'FREE';
      planFeatures = await getTenantFeatures(user.tenantId);
    } catch { /* ignore */ }
  }

  return new SignJWT({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId,
    branchId: user.branchId,
    pwd: user.pwdVersion ?? 1,
    plan,
    planFeatures,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.SESSION_HOURS ? `${process.env.SESSION_HOURS}h` : '12h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionUser & { pwd: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      name: payload.name as string,
      username: payload.username as string,
      role: payload.role as string,
      tenantId: (payload.tenantId as string) ?? null,
      branchId: (payload.branchId as string) ?? null,
      pwd: (payload.pwd as number) ?? 1,
      plan: (payload.plan as string) ?? 'FREE',
      planFeatures: (payload.planFeatures as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

async function verifyApiKey(authHeader: string): Promise<SessionUser | null> {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !token.startsWith('dtms_')) return null;

  const keyHash = crypto.createHash('sha256').update(token).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { tenant: { select: { id: true, active: true, status: true } } },
  });

  if (!apiKey || !apiKey.active) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  if (apiKey.tenantId && (!apiKey.tenant?.active || apiKey.tenant?.status !== 'ACTIVE')) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  }).catch(() => {});

  const serviceUser = await prisma.user.findFirst({
    where: { tenantId: apiKey.tenantId, role: 'ADMIN_OPERASIONAL', status: 'ACTIVE' },
    select: { id: true, name: true, username: true, role: true, tenantId: true, branchId: true },
  });

  if (!serviceUser) return null;

  return {
    id: serviceUser.id,
    name: serviceUser.name,
    username: `apikey:${apiKey.keyPrefix}`,
    role: serviceUser.role,
    tenantId: serviceUser.tenantId,
    branchId: serviceUser.branchId,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();

  // Check superadmin secure session first
  const saToken = store.get('dtms_sa_token')?.value;
  if (saToken) {
    const { verifySuperAdminToken, buildFingerprintFromHeaders } = await import('./superadmin-auth');
    const result = await verifySuperAdminToken(saToken);
    if (result.valid && result.payload) {
      const p = result.payload;
      // Verifikasi fingerprint: token SA terikat pada IP+User-Agent saat login
      const h = await headers();
      if (p.fp !== buildFingerprintFromHeaders(h)) {
        return null;
      }
      const user = await prisma.user.findUnique({
        where: { id: p.id as string },
        select: { id: true, name: true, username: true, role: true, tenantId: true, branchId: true, status: true, pwdVersion: true },
      });
      if (user && user.status === 'ACTIVE' && user.pwdVersion === p.pwd) {
        return { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId, branchId: user.branchId, plan: 'FREE', planFeatures: [] };
      }
    }
  }

  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (!payload) return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, username: true, role: true, tenantId: true, branchId: true, status: true, pwdVersion: true },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    if (user.pwdVersion !== payload.pwd) return null;
    return { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId, branchId: user.branchId, plan: payload.plan, planFeatures: payload.planFeatures };
  }

  const hdrs = await headers();
  const authHeader = hdrs.get('authorization');
  if (authHeader) {
    return verifyApiKey(authHeader);
  }

  return null;
}

export async function setSession(user: SessionUser & { pwdVersion?: number }) {
  const token = await signToken(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * (Number(process.env.SESSION_HOURS) || 12),
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function signTwoFactorToken(userId: string) {
  return new SignJWT({ sub: userId, purpose: '2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function verifyTwoFactorToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== '2fa' || typeof payload.sub !== 'string') return null;
    return payload.sub;
  } catch {
    return null;
  }
}