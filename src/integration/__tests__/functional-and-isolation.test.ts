/**
 * Functional + Multi-Tenant Isolation Integration Tests
 * Run: npx vitest run src/integration/__tests__/functional-and-isolation.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, loginRaw, TENANT_A_ID, TENANT_B_ID, type AuthCtx } from '../helpers';

const BASE = process.env.TEST_URL || 'http://localhost:3000';

let tenantA: AuthCtx & { tenantId: string };
let tenantB: AuthCtx & { tenantId: string };
let superAdmin: AuthCtx;

// ========================= SETUP =========================
beforeAll(async () => {
  const sa = getAuth('superAdmin');
  superAdmin = sa;
  tenantA = { ...getAuth('tenantA'), tenantId: TENANT_A_ID };
  tenantB = { ...getAuth('tenantB'), tenantId: TENANT_B_ID };
});

// ========================= AUTH =========================
describe('Authentication', () => {
  it('login valid: 200', async () => {
    const res = await loginRaw('admin00001', 'admin123', TENANT_A_ID);
    expect(res.status).toBe(200);
    expect(res.json.role).toBeDefined();
  });

  it('login wrong password: 401', async () => {
    const res = await loginRaw('admin00001', 'wrongpass', TENANT_A_ID);
    expect(res.status).toBe(401);
  });

  it('login empty fields: 400', async () => {
    const res = await loginRaw('', '');
    expect(res.status).toBe(400);
  });

  it('GET /api/auth/me returns current user', async () => {
    const res = await api('GET', '/api/auth/me', undefined, tenantA);
    expect(res.status).toBe(200);
    expect(res.json.user.tenantId).toBe(TENANT_A_ID);
    expect(res.json.user.username).toBe('admin00001');
  });

  it('GET /api/auth/me without token: 401', async () => {
    expect((await api('GET', '/api/auth/me')).status).toBe(401);
  });
});

// ========================= TENANT ISOLATION =========================
describe('Multi-Tenant Isolation', () => {
  it('Tenant A drivers belong to tenant A', async () => {
    const res = await api('GET', '/api/drivers?page=1&pageSize=5', undefined, tenantA);
    expect(res.status).toBe(200);
    expect(res.json.items.length).toBeGreaterThan(0);
    for (const d of res.json.items) expect(d.tenantId).toBe(TENANT_A_ID);
  });

  it('Tenant B drivers belong to tenant B', async () => {
    const res = await api('GET', '/api/drivers?page=1&pageSize=5', undefined, tenantB);
    expect(res.status).toBe(200);
    expect(res.json.items.length).toBeGreaterThan(0);
    for (const d of res.json.items) expect(d.tenantId).toBe(TENANT_B_ID);
  });

  it('No overlap between A and B drivers', async () => {
    const [rA, rB] = await Promise.all([
      api('GET', '/api/drivers?page=1&pageSize=50', undefined, tenantA),
      api('GET', '/api/drivers?page=1&pageSize=50', undefined, tenantB),
    ]);
    const idsA = new Set((rA.json.items || []).map((d: any) => d.id));
    expect((rB.json.items || []).some((d: any) => idsA.has(d.id))).toBe(false);
  });

  it('Tenant A vehicles belong to tenant A', async () => {
    const res = await api('GET', '/api/vehicles?page=1&pageSize=5', undefined, tenantA);
    expect(res.status).toBe(200);
    for (const v of res.json.items) expect(v.tenantId).toBe(TENANT_A_ID);
  });

  it('Tenant B vehicles belong to tenant B', async () => {
    const res = await api('GET', '/api/vehicles?page=1&pageSize=5', undefined, tenantB);
    expect(res.status).toBe(200);
    for (const v of res.json.items) expect(v.tenantId).toBe(TENANT_B_ID);
  });

  it('Tenant A shipments belong to tenant A', async () => {
    const res = await api('GET', '/api/shipments?page=1&pageSize=5', undefined, tenantA);
    expect(res.status).toBe(200);
    for (const s of res.json.items) expect(s.tenantId).toBe(TENANT_A_ID);
  });

  it('Tenant B shipments belong to tenant B', async () => {
    const res = await api('GET', '/api/shipments?page=1&pageSize=5', undefined, tenantB);
    expect(res.status).toBe(200);
    for (const s of res.json.items) expect(s.tenantId).toBe(TENANT_B_ID);
  });

  it('IDOR: A cannot read B driver by ID', async () => {
    const b = await api('GET', '/api/drivers?page=1&pageSize=1', undefined, tenantB);
    const id = b.json.items?.[0]?.id;
    if (id) {
      const res = await api('GET', `/api/drivers/${id}`, undefined, tenantA);
      expect([403, 404]).toContain(res.status);
    }
  });

  it('IDOR: A cannot read B vehicle by ID', async () => {
    const b = await api('GET', '/api/vehicles?page=1&pageSize=1', undefined, tenantB);
    const id = b.json.items?.[0]?.id;
    if (id) {
      const res = await api('GET', `/api/vehicles/${id}`, undefined, tenantA);
      expect([403, 404]).toContain(res.status);
    }
  });

  it('IDOR: A cannot read B shipment by ID', async () => {
    const b = await api('GET', '/api/shipments?page=1&pageSize=1', undefined, tenantB);
    const id = b.json.items?.[0]?.id;
    if (id) {
      const res = await api('GET', `/api/shipments/${id}`, undefined, tenantA);
      expect([403, 404]).toContain(res.status);
    }
  });

  it('Super admin sees all 10K+ tenants', async () => {
    const res = await api('GET', '/api/tenants', undefined, superAdmin);
    expect(res.status).toBe(200);
    const items = Array.isArray(res.json) ? res.json : res.json.items || [];
    expect(items.length).toBeGreaterThanOrEqual(10000);
  }, 30000);
});

// ========================= RBAC =========================
describe('RBAC Permissions', () => {
  it('Unauthenticated: 401 on protected routes', async () => {
    for (const ep of ['/api/drivers', '/api/shipments', '/api/vehicles']) {
      expect((await api('GET', ep)).status).toBe(401);
    }
  });

  it('Tenant admin accesses core modules', async () => {
    for (const ep of ['/api/drivers?page=1&pageSize=1', '/api/shipments?page=1&pageSize=1', '/api/vehicles?page=1&pageSize=1']) {
      expect((await api('GET', ep, undefined, tenantA)).status).toBe(200);
    }
  });

  it('CSRF blocks POST without token', async () => {
    const res = await fetch(`${BASE}/api/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': tenantA.cookie },
      body: JSON.stringify({ employeeId: `CSRF${Date.now()}`, name: 'X', phone: '08' }),
    });
    expect(res.status).toBe(403);
  });
});

// ========================= CRUD =========================
describe('CRUD Functional', () => {
  let driverId = '';
  let vehicleId = '';

  it('Create driver (may be blocked by plan limit on FREE tier)', async () => {
    const res = await api('POST', '/api/drivers', { employeeId: `CRUD${Date.now()}`, name: 'CRUD Driver', phone: '081234567890' }, tenantA);
    expect([201, 403]).toContain(res.status);
    if (res.status === 201) driverId = res.json.id;
  });

  it('Read created driver', async () => {
    if (!driverId) return;
    const res = await api('GET', `/api/drivers/${driverId}`, undefined, tenantA);
    expect(res.status).toBe(200);
    expect(res.json.name).toBe('CRUD Driver');
    expect(res.json.tenantId).toBe(TENANT_A_ID);
  });

  it('Update driver', async () => {
    if (!driverId) return;
    const res = await api('PUT', `/api/drivers/${driverId}`, { name: 'CRUD Driver Updated' }, tenantA);
    expect([200, 204]).toContain(res.status);
  });

  it('Create vehicle', async () => {
    const res = await api('POST', '/api/vehicles', {
      vehicleNumber: `V${Date.now()}`, type: 'Van', capacity: 2000,
      photoFront: '/p.jpg', photoBack: '/p.jpg', photoRight: '/p.jpg', photoLeft: '/p.jpg',
    }, tenantA);
    expect(res.status).toBe(201);
    vehicleId = res.json.id;
  });

  it('Read created vehicle', async () => {
    if (!vehicleId) return;
    const res = await api('GET', `/api/vehicles/${vehicleId}`, undefined, tenantA);
    expect(res.status).toBe(200);
    expect(res.json.type).toBe('Van');
    expect(res.json.tenantId).toBe(TENANT_A_ID);
  });

  it('Delete driver', async () => {
    if (!driverId) return;
    const res = await api('DELETE', `/api/drivers/${driverId}`, undefined, tenantA);
    expect([200, 204]).toContain(res.status);
  }, 15000);

  it('Delete vehicle', async () => {
    if (!vehicleId) return;
    const res = await api('DELETE', `/api/vehicles/${vehicleId}`, undefined, tenantA);
    expect([200, 204]).toContain(res.status);
  }, 15000);
});

// ========================= PERFORMANCE =========================
describe('Performance (10M+ dataset)', () => {
  it('Drivers list < 10s', async () => {
    const t = Date.now();
    expect((await api('GET', '/api/drivers?page=1&pageSize=20', undefined, tenantA)).status).toBe(200);
    expect(Date.now() - t).toBeLessThan(10000);
  }, 15000);

  it('Vehicles list < 10s', async () => {
    const t = Date.now();
    expect((await api('GET', '/api/vehicles?page=1&pageSize=20', undefined, tenantA)).status).toBe(200);
    expect(Date.now() - t).toBeLessThan(10000);
  }, 15000);

  it('Shipments list < 10s', async () => {
    const t = Date.now();
    expect((await api('GET', '/api/shipments?page=1&pageSize=20', undefined, tenantA)).status).toBe(200);
    expect(Date.now() - t).toBeLessThan(10000);
  }, 15000);
});
