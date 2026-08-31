/**
 * Integration Tests — Authentication Module
 * Run: npx vitest run src/integration/__tests__/auth.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, getAuth, api, loginRaw, TENANT_A_ID, clearLoginAttempts } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;

beforeAll(async () => {
  await clearLoginAttempts();
  tenantA = getAuth('tenantA');
});

describe('Auth — Login', () => {
  it('valid credentials → 200 with session cookie', async () => {
    const res = await login('admin00001', 'admin123', TENANT_A_ID);
    expect(res.cookie).toContain('dtms_token=');
    expect(res.cookie).toContain('dtms_csrf=');
  });

  it('wrong password → 401 with remainingAttempts', async () => {
    const r = await api('POST', '/api/auth/login', { username: 'admin00001', password: 'wrong', tenantId: TENANT_A_ID });
    expect(r.status).toBe(401);
    expect(r.json.remainingAttempts).toBeDefined();
  });

  it('empty fields → 400', async () => {
    const r = await api('POST', '/api/auth/login', { username: '', password: '' });
    expect(r.status).toBe(400);
  });

  it('invalid tenantId → 400', async () => {
    const r = await api('POST', '/api/auth/login', { username: 'admin00001', password: 'admin123', tenantId: 'nonexistent' });
    expect(r.status).toBe(400);
  });

  it('nonexistent user → 401', async () => {
    const r = await api('POST', '/api/auth/login', { username: 'ghost99999', password: 'x', tenantId: TENANT_A_ID });
    expect(r.status).toBe(401);
  });

  it('superadmin via tenant login → 401 generik (Blueprint §38: wajib secure portal)', async () => {
    const r = await api('POST', '/api/auth/login', { username: 'superadmin', password: process.env.TEST_SA_PASSWORD || 'Admin1234' });
    expect(r.status).toBe(401);
    expect(r.json.error).toBe('Username atau password salah');
    // Anti-enumeration: respons identik dengan kredensial acak
    const ghost = await api('POST', '/api/auth/login', { username: 'tidakada_xz', password: 'whatever123' });
    expect(ghost.json.error).toBe(r.json.error);
  });
});

describe('Auth — Session (GET /api/auth/me)', () => {
  it('authenticated → 200 with user data', async () => {
    const r = await api('GET', '/api/auth/me', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.user.username).toBe('admin00001');
    expect(r.json.user.tenantId).toBe(TENANT_A_ID);
    expect(r.json.user.roleLabel).toBeDefined();
  });

  it('unauthenticated → 401', async () => {
    const r = await api('GET', '/api/auth/me');
    expect(r.status).toBe(401);
  });

  it('tampered cookie → 401', async () => {
    const r = await api('GET', '/api/auth/me', undefined, { cookie: 'dtms_token=garbage', csrf: 'x' });
    expect(r.status).toBe(401);
  });
});

describe('Auth — Logout', () => {
  it('logout clears session → 200', async () => {
    const r = await api('POST', '/api/auth/logout', undefined, tenantA);
    expect(r.status).toBe(200);
    tenantA = { cookie: '', csrf: '' };
  });

  it('subsequent request after logout → 401', async () => {
    const r = await api('GET', '/api/auth/me', undefined, tenantA);
    expect(r.status).toBe(401);
  });

  it('re-login after logout → 200', async () => {
    // Reset trauma brute-force agar re-login tidak terdampak sisa state suite lain
    await clearLoginAttempts();
    tenantA = await login('admin00001', 'admin123', TENANT_A_ID);
    expect(tenantA.cookie).toContain('dtms_token=');
  });
});

describe('Auth — Tenants List (public)', () => {
  it('GET /api/auth/tenants returns active tenants', async () => {
    const r = await api('GET', '/api/auth/tenants');
    expect(r.status).toBe(200);
    const items = Array.isArray(r.json) ? r.json : r.json.items || [];
    expect(items.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Auth — Change Password', () => {
  it('unauthenticated → 403 (CSRF blocks before auth check)', async () => {
    const r = await api('POST', '/api/auth/change-password', { currentPassword: 'admin123', newPassword: 'NewPass123' });
    expect(r.status).toBe(403);
  });

  it('wrong current password → 401', async () => {
    const r = await api('POST', '/api/auth/change-password', {
      currentPassword: 'wrongold',
      newPassword: 'NewPass123',
    }, tenantA);
    expect(r.status).toBe(401);
  });

  it('weak password → 400', async () => {
    const r = await api('POST', '/api/auth/change-password', {
      currentPassword: 'admin123',
      newPassword: 'weak',
    }, tenantA);
    expect(r.status).toBe(400);
  });

  it('same password → 400', async () => {
    const r = await api('POST', '/api/auth/change-password', {
      currentPassword: 'admin123',
      newPassword: 'admin123',
    }, tenantA);
    expect(r.status).toBe(400);
  });

  it('empty fields → 400', async () => {
    const r = await api('POST', '/api/auth/change-password', {}, tenantA);
    expect(r.status).toBe(400);
  });
});

describe('Auth — CSRF Protection', () => {
  it('POST without CSRF token → 403', async () => {
    const res = await fetch(`${process.env.TEST_URL || 'http://localhost:3000'}/api/customers?page=1&pageSize=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': tenantA.cookie },
      body: JSON.stringify({ name: 'X', phone: '081' }),
    });
    expect(res.status).toBe(403);
  });

  it('POST with wrong CSRF token → 403', async () => {
    const r = await api('POST', '/api/customers', { name: 'X', phone: '081' }, {
      cookie: tenantA.cookie,
      csrf: 'wrong-csrf-token',
    });
    expect(r.status).toBe(403);
  });
});
