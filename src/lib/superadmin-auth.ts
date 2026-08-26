import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { ADMIN_AUTH_POLICY } from './admin-policy';

const SUPERADMIN_ALLOWED_IPS = (process.env.SUPERADMIN_ALLOWED_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET);

export const SUPERADMIN_COOKIE = 'dtms_sa_token';

// Normalisasi IP agar fingerprint stabil: ::ffff:127.0.0.1, 127.0.0.1, dan ::1
// harus menghasilkan nilai yang sama (IPv4-mapped IPv6 & loopback variants).
export function normalizeIp(ip: string): string {
  let v = ip.trim();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  if (v === '127.0.0.1' || v === '::1') return 'local';
  return v;
}

export function getClientIpSa(req: NextRequest): string {
  // Ambil hop paling kanan dari X-Forwarded-For (ditambahkan proxy terpercaya kita),
  // bukan yang pertama (dapat dipalsukan klien).
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return normalizeIp(parts[parts.length - 1]);
  }
  return normalizeIp(req.headers.get('x-real-ip') || 'local');
}

export function isIpWhitelisted(ip: string): boolean {
  if (SUPERADMIN_ALLOWED_IPS.length === 0) return true;
  if (ip === 'local' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  return SUPERADMIN_ALLOWED_IPS.includes(ip);
}

export function verifySecretKey(key: string): boolean {
  const expected = process.env.SUPERADMIN_SECRET_KEY;
  if (!expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function buildFingerprint(req: NextRequest): string {
  const ua = req.headers.get('user-agent') || 'unknown';
  const ip = getClientIpSa(req);
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 32);
}

export function buildFingerprintFromHeaders(h: Headers): string {
  const ua = h.get('user-agent') || 'unknown';
  let ip = 'local';
  const fwd = h.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) ip = parts[parts.length - 1];
  } else {
    ip = h.get('x-real-ip') || 'local';
  }
  return crypto.createHash('sha256').update(`${normalizeIp(ip)}:${ua}`).digest('hex').slice(0, 32);
}

export async function signSuperAdminStep1Token(): Promise<string> {
  return new SignJWT({ purpose: 'sa_step1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(SECRET);
}

export async function verifySuperAdminStep1Token(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.purpose === 'sa_step1';
  } catch { return false; }
}

/** Token jembatan antara step-2 (password OK) dan step-3 (MFA) — Blueprint §37 MFA_REQUIRED */
export async function signSuperAdminMfaToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'sa_mfa', uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${Math.ceil(ADMIN_AUTH_POLICY.mfaTokenTtlMs / 1000)}s`)
    .sign(SECRET);
}

export async function verifySuperAdminMfaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== 'sa_mfa' || typeof payload.uid !== 'string') return null;
    return payload.uid;
  } catch { return null; }
}

export async function signSuperAdminToken(
  user: { id: string; name: string; username: string; role: string; tenantId: string | null; branchId: string | null; pwdVersion: number; mustChangePassword?: boolean },
  fingerprint: string
) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId,
    branchId: user.branchId,
    pwd: user.pwdVersion,
    fp: fingerprint,
    sa: true,
    mcp: user.mustChangePassword === true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_AUTH_POLICY.maxSessionMinutes}m`)
    .sign(SECRET);
}

export async function verifySuperAdminToken(token: string): Promise<{ valid: boolean; payload?: Record<string, unknown>; fingerprintMismatch?: boolean }> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.sa !== true) return { valid: false };
    return { valid: true, payload: payload as unknown as Record<string, unknown> };
  } catch { return { valid: false }; }
}

export async function setSuperAdminSession(user: { id: string; name: string; username: string; role: string; tenantId: string | null; branchId: string | null; pwdVersion: number; mustChangePassword?: boolean }, fingerprint: string) {
  const token = await signSuperAdminToken(user, fingerprint);
  const store = await cookies();
  store.set(SUPERADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * ADMIN_AUTH_POLICY.maxSessionMinutes,
  });
}

export async function clearSuperAdminSession() {
  const store = await cookies();
  store.delete(SUPERADMIN_COOKIE);
}

// In-memory rate limit for superadmin login (stricter)
const saAttempts = new Map<string, { count: number; firstAt: number }>();
const SA_MAX = 3;
const SA_WINDOW = 15 * 60 * 1000;

export function isSaRateLimited(ip: string): { blocked: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = saAttempts.get(ip);
  if (!entry || now - entry.firstAt > SA_WINDOW) {
    saAttempts.delete(ip);
    return { blocked: false };
  }
  if (entry.count >= SA_MAX) {
    const retryAfter = Math.ceil((entry.firstAt + SA_WINDOW - now) / 1000);
    return { blocked: true, retryAfter };
  }
  return { blocked: false };
}

export function recordSaAttempt(ip: string) {
  const now = Date.now();
  const entry = saAttempts.get(ip);
  if (!entry || now - entry.firstAt > SA_WINDOW) {
    saAttempts.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count++;
  }
}

export function resetSaAttempts(ip: string) {
  saAttempts.delete(ip);
}

// ── Lockout per-akun (Blueprint §25: jangan IP-only) ────────────────────────
// Kunci berdasarkan username sehingga rotasi IP tidak mem-bypass.
// Progressive delay: pelanggaran ke-N terkunci base * 2^(N-max), maks maxMs.
type AccountEntry = { violations: number; lastViolationAt: number; windowStart: number; fails: number };

const saAccount = new Map<string, AccountEntry>();

function pruneAccount(e: AccountEntry): boolean {
  return Date.now() - e.windowStart > ADMIN_AUTH_POLICY.accountWindowMs;
}

export function isSaAccountBlocked(username: string): { blocked: boolean; retryAfterSec?: number } {
  const key = username.trim().toLowerCase();
  const e = saAccount.get(key);
  if (!e || pruneAccount(e)) {
    if (e) saAccount.delete(key);
    return { blocked: false };
  }
  if (e.fails < ADMIN_AUTH_POLICY.accountMaxAttempts) return { blocked: false };
  const level = Math.min(e.violations - ADMIN_AUTH_POLICY.accountMaxAttempts + 1, 10);
  const lockMs = Math.min(
    ADMIN_AUTH_POLICY.accountLockBaseMs * 2 ** Math.max(0, level - 1),
    ADMIN_AUTH_POLICY.accountLockMaxMs
  );
  const until = e.lastViolationAt + lockMs;
  if (Date.now() < until) {
    return { blocked: true, retryAfterSec: Math.ceil((until - Date.now()) / 1000) };
  }
  // Masa lock lewat — reset hitungan gagal, pertahankan riwayat pelanggaran
  e.fails = 0;
  e.windowStart = Date.now();
  return { blocked: false };
}

export function recordSaAccountFailure(username: string) {
  const key = username.trim().toLowerCase();
  const now = Date.now();
  let e = saAccount.get(key);
  if (!e || pruneAccount(e)) {
    e = { violations: 0, lastViolationAt: now, windowStart: now, fails: 0 };
    saAccount.set(key, e);
  }
  e.lastViolationAt = now;
  e.fails++;
  if (e.fails > ADMIN_AUTH_POLICY.accountMaxAttempts) e.violations++;
}

export function resetSaAccountFailures(username: string) {
  saAccount.delete(username.trim().toLowerCase());
}
