/**
 * Integration Tests — Tenants Admin
 * Run: npx vitest run src/integration/__tests__/tenants.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, TENANT_A_ID } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;
let superAdmin: ReturnType<typeof getAuth>;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
  superAdmin = getAuth('superAdmin');
});

describe('Tenants — List (GET /api/tenants)', () => {
  it('superadmin → 200 with all tenants', async () => {
    const r = await api('GET', '/api/tenants?pageSize=100', undefined, superAdmin);
    expect(r.status).toBe(200);
    const total = typeof r.json.total === 'number' ? r.json.total : 0;
    expect(total).toBeGreaterThanOrEqual(3);
  }, 30000);

  it('tenant admin cannot list all tenants (SA-only)', async () => {
    const r = await api('GET', '/api/tenants', undefined, tenantA);
    expect([401, 403]).toContain(r.status);
  });

  it('unauthenticated → 401', async () => {
    const r = await api('GET', '/api/tenants');
    expect(r.status).toBe(401);
  });
});

describe('Tenants — Create (POST /api/tenants)', () => {
  it('superadmin valid data → 201', async () => {
    const slug = `test-${Date.now()}`;
    const r = await api('POST', '/api/tenants', { name: 'Test Tenant', slug }, superAdmin);
    expect(r.status).toBe(201);
    expect(r.json.id).toBeDefined();
    expect(r.json.slug).toBe(slug);
    expect(r.json.status).toBe('ACTIVE');
    expect(r.json.plan).toBe('FREE');
  });

  it('tenant admin → 401 (not superadmin)', async () => {
    const r = await api('POST', '/api/tenants', { name: 'X', slug: `x-${Date.now()}` }, tenantA);
    expect(r.status).toBe(401);
  });

  it('missing name → 400', async () => {
    const r = await api('POST', '/api/tenants', { slug: `x-${Date.now()}` }, superAdmin);
    expect(r.status).toBe(400);
  });

  it('missing slug → 400', async () => {
    const r = await api('POST', '/api/tenants', { name: 'X' }, superAdmin);
    expect(r.status).toBe(400);
  });

  it('invalid slug (uppercase) → 400', async () => {
    const r = await api('POST', '/api/tenants', { name: 'X', slug: 'INVALID-SLUG' }, superAdmin);
    expect(r.status).toBe(400);
  });

  it('duplicate slug → 409', async () => {
    const slug = `dup-${Date.now()}`;
    await api('POST', '/api/tenants', { name: 'A', slug }, superAdmin);
    const r = await api('POST', '/api/tenants', { name: 'B', slug }, superAdmin);
    expect(r.status).toBe(409);
  });
});

describe('Tenants — Detail (GET /api/tenants/:id)', () => {
  it('superadmin can get tenant by ID', async () => {
    const r = await api('GET', `/api/tenants/${TENANT_A_ID}`, undefined, superAdmin);
    expect(r.status).toBe(200);
    expect(r.json.id).toBe(TENANT_A_ID);
  });

  it('tenant admin can get tenant', async () => {
    const r = await api('GET', `/api/tenants/${TENANT_A_ID}`, undefined, tenantA);
    expect(r.status).toBe(200);
  });
});
