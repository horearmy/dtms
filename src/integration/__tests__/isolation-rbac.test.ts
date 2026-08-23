/**
 * Integration Tests — Cross-Tenant Isolation + RBAC
 * Run: npx vitest run src/integration/__tests__/isolation-rbac.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, TENANT_A_ID, TENANT_B_ID } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;
let tenantB: ReturnType<typeof getAuth>;
let superAdmin: ReturnType<typeof getAuth>;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
  tenantB = getAuth('tenantB');
  superAdmin = getAuth('superAdmin');
});

describe('IDOR — Drivers', () => {
  const modules = [
    { label: 'drivers', listEp: '/api/drivers?page=1&pageSize=1' },
    { label: 'vehicles', listEp: '/api/vehicles?page=1&pageSize=1' },
    { label: 'shipments', listEp: '/api/shipments?page=1&pageSize=1' },
  ];

  for (const mod of modules) {
    it(`${mod.label}: B cannot read A's record by ID`, async () => {
      const a = await api('GET', mod.listEp, undefined, tenantA);
      const id = a.json.items?.[0]?.id;
      if (!id) return;
      const base = mod.listEp.replace(/\?.*/, '');
      const r = await api('GET', `${base}/${id}`, undefined, tenantB);
      expect([403, 404]).toContain(r.status);
    });

    it(`${mod.label}: B cannot update A's record`, async () => {
      const a = await api('GET', mod.listEp, undefined, tenantA);
      const id = a.json.items?.[0]?.id;
      if (!id) return;
      const base = mod.listEp.replace(/\?.*/, '');
      const r = await api('PATCH', `${base}/${id}`, { name: 'Hijacked' }, tenantB);
      expect([403, 404, 405]).toContain(r.status);
    });

    it(`${mod.label}: B cannot delete A's record`, async () => {
      const a = await api('GET', mod.listEp, undefined, tenantA);
      const id = a.json.items?.[0]?.id;
      if (!id) return;
      const base = mod.listEp.replace(/\?.*/, '');
      const r = await api('DELETE', `${base}/${id}`, undefined, tenantB);
      expect([400, 403, 404, 405]).toContain(r.status);
    });
  }
});

describe('Tenant Scoping — All list endpoints', () => {
  it('A drivers ≠ B drivers', async () => {
    const [rA, rB] = await Promise.all([
      api('GET', '/api/drivers?page=1&pageSize=50', undefined, tenantA),
      api('GET', '/api/drivers?page=1&pageSize=50', undefined, tenantB),
    ]);
    const idsA = new Set(rA.json.items.map((d: any) => d.id));
    expect(rB.json.items.every((d: any) => !idsA.has(d.id))).toBe(true);
  });

  it('A vehicles ≠ B vehicles', async () => {
    const [rA, rB] = await Promise.all([
      api('GET', '/api/vehicles?page=1&pageSize=50', undefined, tenantA),
      api('GET', '/api/vehicles?page=1&pageSize=50', undefined, tenantB),
    ]);
    const idsA = new Set(rA.json.items.map((v: any) => v.id));
    expect(rB.json.items.every((v: any) => !idsA.has(v.id))).toBe(true);
  });

  it('A shipments ≠ B shipments', async () => {
    const [rA, rB] = await Promise.all([
      api('GET', '/api/shipments?page=1&pageSize=50', undefined, tenantA),
      api('GET', '/api/shipments?page=1&pageSize=50', undefined, tenantB),
    ]);
    const idsA = new Set(rA.json.items.map((s: any) => s.id));
    expect(rB.json.items.every((s: any) => !idsA.has(s.id))).toBe(true);
  });

  it('A customers ≠ B customers', async () => {
    const [rA, rB] = await Promise.all([
      api('GET', '/api/customers?page=1&pageSize=50', undefined, tenantA),
      api('GET', '/api/customers?page=1&pageSize=50', undefined, tenantB),
    ]);
    const idsA = new Set(rA.json.items.map((c: any) => c.id));
    expect(rB.json.items.every((c: any) => !idsA.has(c.id))).toBe(true);
  });
});

describe('Super Admin — Cross-tenant access', () => {
  it('SA can list all tenants', async () => {
    const r = await api('GET', '/api/tenants?pageSize=100', undefined, superAdmin);
    expect(r.status).toBe(200);
    const total = r.json.total ?? 0;
    expect(total).toBeGreaterThanOrEqual(10000);
  }, 30000);

  it('SA can access tenant detail', async () => {
    const r = await api('GET', `/api/tenants/${TENANT_A_ID}`, undefined, superAdmin);
    expect(r.status).toBe(200);
  });
});

describe('RBAC — Unauthenticated access blocked', () => {
  const endpoints = [
    '/api/drivers',
    '/api/vehicles',
    '/api/customers',
    '/api/shipments',
    '/api/gps/latest',
    '/api/notifications',
    '/api/control-tower',
    '/api/dispatch',
    '/api/geofences',
    '/api/webhooks',
    '/api/integrations',
    '/api/api-keys',
    '/api/audit',
    '/api/daily-reports',
    '/api/exceptions',
    '/api/sla-policies',
    '/api/warehouse/scans',
    '/api/files',
    '/api/messages',
  ];

  for (const ep of endpoints) {
    it(`GET ${ep} → 401`, async () => {
      const r = await api('GET', ep);
      expect(r.status).toBe(401);
    });
  }
});

describe('RBAC — CSRF protection', () => {
  const postEndpoints = [
    ['/api/drivers', { employeeId: 'X', name: 'X', phone: '081' }],
    ['/api/vehicles', { vehicleNumber: 'X', type: 'Van', photoFront: '/p.jpg', photoBack: '/p.jpg', photoRight: '/p.jpg', photoLeft: '/p.jpg' }],
    ['/api/customers', { name: 'X', phone: '081' }],
  ];

  for (const [ep, body] of postEndpoints) {
    it(`POST ${ep} without CSRF → 403`, async () => {
      const res = await fetch(`${process.env.TEST_URL || 'http://localhost:3000'}${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': tenantA.cookie },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(403);
    });
  }
});

describe('RBAC — Tenant admin cannot act as superadmin', () => {
  it('cannot create tenant', async () => {
    const r = await api('POST', '/api/tenants', { name: 'X', slug: `hack-${Date.now()}` }, tenantA);
    expect(r.status).toBe(401);
  });
});
