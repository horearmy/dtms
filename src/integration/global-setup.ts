/**
 * Vitest global setup — runs once before ALL test files.
 * Logs in all test users once, writes tokens to a JSON file
 * so individual test files don't need to login (avoids brute-force lockout).
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.TEST_URL || 'http://localhost:3000';
const TOKEN_FILE = join(__dirname, '.test-tokens.json');

const USERS = [
  { key: 'tenantA', username: 'admin00001', password: 'admin123', tenantId: '357011aa-60f3-46cc-b3d6-7b5231c4747f' },
  { key: 'tenantB', username: 'admin00002', password: 'admin123', tenantId: 'f7f63209-f17d-4da5-ac36-65171a291e8b' },
];

// Blueprint §38: superadmin TIDAK bisa lewat /api/auth/login lagi.
// Ambil sesi SA melalui secure portal (step1 secret key -> step2 password).
const SECRET_KEY = process.env.TEST_SA_SECRET_KEY || 'DTMS-SEC-2026-XK9!mPz#vR';

async function clearLoginAttempts() {
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  await p.$executeRawUnsafe('DELETE FROM "LoginAttempt"');
  await p.$disconnect();
}

function extractCookies(setCookie: string | null) {
  const tokenMatch = setCookie?.match(/dtms_token=([^;]+)/);
  const saMatch = setCookie?.match(/dtms_sa_token=([^;]+)/);
  const csrfMatch = setCookie?.match(/dtms_csrf=([^;]+)/);
  return { token: tokenMatch?.[1] || '', saToken: saMatch?.[1] || '', csrf: csrfMatch?.[1] || '' };
}

async function login(username: string, password: string, tenantId?: string): Promise<{ cookie: string; csrf: string }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, ...(tenantId ? { tenantId } : {}) }),
    redirect: 'manual',
  });
  const { token, csrf } = extractCookies(res.headers.get('set-cookie'));
  if (!token) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Global setup login failed for ${username} (status ${res.status}): ${JSON.stringify(body)}`);
  }
  return { cookie: `dtms_token=${token}; dtms_csrf=${csrf}`, csrf };
}

async function loginSuperAdmin(username: string, password: string): Promise<{ cookie: string; csrf: string }> {
  const s1 = await fetch(`${BASE}/api/auth/superadmin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 1, secretKey: SECRET_KEY }),
  });
  if (!s1.ok) throw new Error(`SA step1 failed (${s1.status})`);
  const { sessionToken } = await s1.json();

  const s2 = await fetch(`${BASE}/api/auth/superadmin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 2, sessionToken, username, password }),
  });
  const data = await s2.json().catch(() => ({}));
  if (!s2.ok) throw new Error(`SA step2 failed (${s2.status}): ${JSON.stringify(data)}`);
  if (data.mfaRequired) throw new Error('SA akun tes memiliki TOTP aktif — sediakan TEST_SA_TOTP_CODE atau matikan 2FA untuk akun seed.');

  const { saToken, csrf } = extractCookies(s2.headers.get('set-cookie'));
  if (!saToken) throw new Error('SA login tidak menghasilkan dtms_sa_token');

  // Portal responses (public) tidak menyertakan dtms_csrf — dapatkan lewat
  // satu GET terproteksi agar mutasi berikutnya lolos verifikasi CSRF.
  let saCsrf = csrf;
  const probe = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: `dtms_sa_token=${saToken}`, 'User-Agent': 'dtms-integration' },
  });
  saCsrf = extractCookies(probe.headers.get('set-cookie')).csrf || saCsrf;
  if (!saCsrf) {
    // Sudah ada sejak request sebelumnya? Ambil dari cookie yang dikirim balik tidak mungkin —
    // fallback: gagalkan dengan pesan jelas.
    throw new Error('Gagal memperoleh dtms_csrf untuk sesi SA');
  }
  return { cookie: `dtms_sa_token=${saToken}; dtms_csrf=${saCsrf}`, csrf: saCsrf };
}

export async function setup() {
  await clearLoginAttempts();
  const tokens: Record<string, { cookie: string; csrf: string }> = {};

  for (const user of USERS) {
    tokens[user.key] = await login(user.username, user.password, user.tenantId);
  }
  tokens.superAdmin = await loginSuperAdmin('superadmin', process.env.TEST_SA_PASSWORD || 'Admin1234');

  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

export async function teardown() {
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(TOKEN_FILE);
  } catch { /* file may not exist */ }
}
