import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

export const COOKIE_NAME = 'dtms_token';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dtms-dev-secret-change-me'
);

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: string;
};

export async function signToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      name: payload.name as string,
      username: payload.username as string,
      role: payload.role as string,
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
  return { id: user.id, name: user.name, username: user.username, role: user.role };
}

export async function setSession(user: SessionUser) {
  const token = await signToken(user);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export function can(role: string, ...roles: string[]) {
  return roles.includes(role);
}