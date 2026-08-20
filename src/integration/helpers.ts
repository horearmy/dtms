/**
 * Test helpers — shared login, API client, cleanup utilities
 *
 * Auth tokens are cached by the global setup (vitest globalSetup) so that
 * test files do NOT need to login themselves — avoiding brute-force lockout.
 * Use getAuth('tenantA') etc. in beforeAll instead of login().
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.TEST_URL || 'http://localhost:3000';
const TOKEN_FILE = join(__dirname, '.test-tokens.json');

export const TENANT_A_ID = '357011aa-60f3-46cc-b3d6-7b5231c4747f';
export const TENANT_B_ID = 'f7f63209-f17d-4da5-ac36-65171a291e8b';

export type AuthCtx = { cookie: string; csrf: string };

let cachedTokens: Record<string, AuthCtx> = {};

function loadTokens(): Record<string, AuthCtx> {
  if (Object.keys(cachedTokens).length === 0) {
    try {
      cachedTokens = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
    } catch {
      throw new Error(`Token file not found: ${TOKEN_FILE}. Did global-setup run?`);
    }
  }
  return cachedTokens;
}

export function getAuth(key: 'tenantA' | 'tenantB' | 'superAdmin'): AuthCtx {
  return loadTokens()[key];
}

function extractCookies(setCookie: string | null) {
  const tokenMatch = setCookie?.match(/dtms_token=([^;]+)/);
  const csrfMatch = setCookie?.match(/dtms_csrf=([^;]+)/);
  return { token: tokenMatch?.[1] || '', csrf: csrfMatch?.[1] || '' };
}

export async function login(username: string, password: string, tenantId?: string): Promise<AuthCtx> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, ...(tenantId ? { tenantId } : {}) }),
    redirect: 'manual',
  });
  const { token, csrf } = extractCookies(res.headers.get('set-cookie'));
  if (!token) throw new Error(`Login failed for ${username}: ${JSON.stringify(await res.json().catch(() => ({})))}`);
  return { cookie: `dtms_token=${token}; dtms_csrf=${csrf}`, csrf };
}

export async function api(method: string, path: string, body?: unknown, auth?: AuthCtx, timeoutMs = 10000) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth?.cookie) headers['Cookie'] = auth.cookie;
  if (auth?.csrf) headers['x-csrf-token'] = auth.csrf;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json, headers: res.headers };
}

export async function loginRaw(username: string, password: string, tenantId?: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, ...(tenantId ? { tenantId } : {}) }),
    redirect: 'manual',
  });
  const { token, csrf } = extractCookies(res.headers.get('set-cookie'));
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, token, csrf };
}

export async function clearLoginAttempts() {
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  await p.$executeRawUnsafe('DELETE FROM "LoginAttempt"');
  await p.$disconnect();
}
