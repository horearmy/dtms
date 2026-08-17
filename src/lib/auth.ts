import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

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
};

export async function signToken(user: SessionUser & { pwdVersion?: number }) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId,
    pwd: user.pwdVersion ?? 1,
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
      pwd: (payload.pwd as number) ?? 1,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || user.status !== 'ACTIVE') return null;
  if (user.pwdVersion !== payload.pwd) return null;
  return { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId };
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

export function can(role: string, ...roles: string[]) {
  return roles.includes(role);
}