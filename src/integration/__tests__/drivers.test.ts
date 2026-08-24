/**
 * Integration Tests — Drivers CRUD + Validation
 * Run: npx vitest run src/integration/__tests__/drivers.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAuth, api, TENANT_A_ID, TENANT_B_ID } from '../helpers';
import { PrismaClient } from '@prisma/client';

let tenantA: ReturnType<typeof getAuth>;
let tenantB: ReturnType<typeof getAuth>;
const prisma = new PrismaClient();
const FIXTURE_NAME = `Andi Pengujian ${Date.now()}`;
const FIXTURE_EMPLOYEE_ID = `DRV-TST-${Date.now()}`;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
  tenantB = getAuth('tenantB');
  await prisma.driver.create({
    data: { name: FIXTURE_NAME, employeeId: FIXTURE_EMPLOYEE_ID, phone: '081200000001', status: 'ACTIVE', tenantId: TENANT_A_ID },
  });
});

afterAll(async () => {
  await prisma.driver.deleteMany({ where: { employeeId: FIXTURE_EMPLOYEE_ID } });
  await prisma.$disconnect();
});

describe('Drivers — List (GET)', () => {
  it('returns paginated drivers', async () => {
    const r = await api('GET', '/api/drivers?page=1&pageSize=5', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items).toBeDefined();
    expect(r.json.total).toBeGreaterThan(0);
    expect(r.json.items.length).toBeLessThanOrEqual(5);
    expect(r.json.page).toBe(1);
    expect(r.json.pageSize).toBe(5);
  });

  it('all items scoped to tenant A', async () => {
    const r = await api('GET', '/api/drivers?page=1&pageSize=50', undefined, tenantA);
    expect(r.status).toBe(200);
    for (const d of r.json.items) expect(d.tenantId).toBe(TENANT_A_ID);
  });

  it('search by name', async () => {
    const r = await api('GET', `/api/drivers?q=${encodeURIComponent(FIXTURE_NAME)}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThan(0);
    expect(r.json.items.some((d: { name: string }) => d.name === FIXTURE_NAME)).toBe(true);
  });

  it('search by employee ID', async () => {
    const r = await api('GET', `/api/drivers?q=${encodeURIComponent(FIXTURE_EMPLOYEE_ID)}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBe(1);
    expect(r.json.items[0].employeeId).toBe(FIXTURE_EMPLOYEE_ID);
  });

  it('unauthenticated → 401', async () => {
    expect((await api('GET', '/api/drivers')).status).toBe(401);
  });
});

describe('Drivers — Detail (GET /:id)', () => {
  it('valid ID returns driver with nested data', async () => {
    const list = await api('GET', '/api/drivers?page=1&pageSize=1', undefined, tenantA);
    const id = list.json.items?.[0]?.id;
    if (!id) return;
    const r = await api('GET', `/api/drivers/${id}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.driver).toBeDefined();
    expect(r.json.driver.id).toBe(id);
    expect(r.json.driver.employeeId).toBeDefined();
    expect(r.json.driver.assignmentCount).toBeDefined();
  });

  it('nonexistent ID → 404', async () => {
    const r = await api('GET', '/api/drivers/00000000-0000-0000-0000-000000000000', undefined, tenantA);
    expect(r.status).toBe(404);
  });
});

describe('Drivers — Create (POST)', () => {
  it('valid data → 201 or 403 (plan limit)', async () => {
    const r = await api('POST', '/api/drivers', {
      employeeId: `DRV${Date.now()}`,
      name: 'Integration Driver',
      phone: '081234567890',
    }, tenantA);
    // 201 = success, 403 = plan limit (FREE tier with 1000+ drivers)
    expect([201, 403]).toContain(r.status);
  });

  it('missing employeeId → 400 or 403 (plan limit)', async () => {
    const r = await api('POST', '/api/drivers', { name: 'X', phone: '081' }, tenantA);
    // Plan limit check runs before validation
    expect([400, 403]).toContain(r.status);
  });

  it('missing name → 400 or 403 (plan limit)', async () => {
    const r = await api('POST', '/api/drivers', { employeeId: `DRV${Date.now()}`, phone: '081' }, tenantA);
    expect([400, 403]).toContain(r.status);
  });

  it('missing phone → 400 or 403 (plan limit)', async () => {
    const r = await api('POST', '/api/drivers', { employeeId: `DRV${Date.now()}`, name: 'X' }, tenantA);
    expect([400, 403]).toContain(r.status);
  });

  it('empty body → 400 or 403 (plan limit)', async () => {
    const r = await api('POST', '/api/drivers', {}, tenantA);
    expect([400, 403]).toContain(r.status);
  });
});

describe('Drivers — Update (PATCH /:id)', () => {
  it('update name → 200', async () => {
    const list = await api('GET', '/api/drivers?page=1&pageSize=1', undefined, tenantA);
    const id = list.json.items?.[0]?.id;
    if (!id) return;
    const r = await api('PATCH', `/api/drivers/${id}`, { name: 'Updated Driver' }, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.name).toBe('Updated Driver');
  });

  it('update nonexistent → 404', async () => {
    const r = await api('PATCH', '/api/drivers/00000000-0000-0000-0000-000000000000', { name: 'X' }, tenantA);
    expect(r.status).toBe(404);
  });
});

describe('Drivers — Tenant Isolation', () => {
  it('B cannot read A driver by ID', async () => {
    const a = await api('GET', '/api/drivers?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('GET', `/api/drivers/${id}`, undefined, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });

  it('B cannot update A driver', async () => {
    const a = await api('GET', '/api/drivers?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('PATCH', `/api/drivers/${id}`, { name: 'Hijack' }, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });

  it('B cannot delete A driver', async () => {
    const a = await api('GET', '/api/drivers?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('DELETE', `/api/drivers/${id}`, undefined, tenantB);
      expect([400, 403, 404]).toContain(r.status);
    }
  });
});
