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
  { key: 'superAdmin', username: 'superadmin', password: process.env.TEST_SA_PASSWORD || 'Admin1234', tenantId: undefined },
];

async function clearLoginAttempts() {
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  await p.$executeRawUnsafe('DELETE FROM "LoginAttempt"');
  await p.$disconnect();
}

function extractCookies(setCookie: string | null) {
  const tokenMatch = setCookie?.match(/dtms_token=([^;]+)/);
  const csrfMatch = setCookie?.match(/dtms_csrf=([^;]+)/);
  return { token: tokenMatch?.[1] || '', csrf: csrfMatch?.[1] || '' };
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

export async function setup() {
  await clearLoginAttempts();
  const tokens: Record<string, { cookie: string; csrf: string }> = {};

  for (const user of USERS) {
    tokens[user.key] = await login(user.username, user.password, user.tenantId);
  }

  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

export async function teardown() {
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(TOKEN_FILE);
  } catch { /* file may not exist */ }
}
