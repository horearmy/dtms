/**
 * Integration Tests — Vehicles CRUD + Validation
 * Run: npx vitest run src/integration/__tests__/vehicles.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, TENANT_A_ID, TENANT_B_ID } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;
let tenantB: ReturnType<typeof getAuth>;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
  tenantB = getAuth('tenantB');
});

describe('Vehicles — List (GET)', () => {
  it('returns paginated vehicles', async () => {
    const r = await api('GET', '/api/vehicles?page=1&pageSize=5', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items).toBeDefined();
    expect(r.json.total).toBeGreaterThan(0);
  });

  it('all items scoped to tenant', async () => {
    const r = await api('GET', '/api/vehicles?page=1&pageSize=50', undefined, tenantA);
    expect(r.status).toBe(200);
    for (const v of r.json.items) expect(v.tenantId).toBe(TENANT_A_ID);
  });

  it('unauthenticated → 401', async () => {
    expect((await api('GET', '/api/vehicles')).status).toBe(401);
  });
});

describe('Vehicles — Detail (GET /:id)', () => {
  it('valid ID returns vehicle', async () => {
    const list = await api('GET', '/api/vehicles?page=1&pageSize=1', undefined, tenantA);
    const id = list.json.items?.[0]?.id;
    if (!id) return;
    const r = await api('GET', `/api/vehicles/${id}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.id).toBe(id);
  });

  it('nonexistent → 404', async () => {
    const r = await api('GET', '/api/vehicles/00000000-0000-0000-0000-000000000000', undefined, tenantA);
    expect(r.status).toBe(404);
  });
});

describe('Vehicles — Create (POST)', () => {
  it('valid data → 201', async () => {
    const r = await api('POST', '/api/vehicles', {
      vehicleNumber: `B${Date.now() % 1000000}TST`,
      type: 'Van',
      capacity: 2000,
      photoFront: '/p.jpg',
      photoBack: '/p.jpg',
      photoRight: '/p.jpg',
      photoLeft: '/p.jpg',
    }, tenantA);
    expect(r.status).toBe(201);
    expect(r.json.id).toBeDefined();
    expect(r.json.type).toBe('Van');
  });

  it('missing vehicleNumber → 400', async () => {
    const r = await api('POST', '/api/vehicles', { type: 'Van', photoFront: '/p.jpg', photoBack: '/p.jpg', photoRight: '/p.jpg', photoLeft: '/p.jpg' }, tenantA);
    expect(r.status).toBe(400);
  });

  it('missing type → 400', async () => {
    const r = await api('POST', '/api/vehicles', { vehicleNumber: `B${Date.now()}X`, photoFront: '/p.jpg', photoBack: '/p.jpg', photoRight: '/p.jpg', photoLeft: '/p.jpg' }, tenantA);
    expect(r.status).toBe(400);
  });

  it('missing photos → 400', async () => {
    const r = await api('POST', '/api/vehicles', { vehicleNumber: `B${Date.now()}X`, type: 'Van' }, tenantA);
    expect(r.status).toBe(400);
  });

  it('duplicate vehicleNumber → 400', async () => {
    const vn = `DUP${Date.now()}`;
    await api('POST', '/api/vehicles', { vehicleNumber: vn, type: 'Van', photoFront: '/p.jpg', photoBack: '/p.jpg', photoRight: '/p.jpg', photoLeft: '/p.jpg' }, tenantA);
    const r = await api('POST', '/api/vehicles', { vehicleNumber: vn, type: 'Truck', photoFront: '/p.jpg', photoBack: '/p.jpg', photoRight: '/p.jpg', photoLeft: '/p.jpg' }, tenantA);
    expect(r.status).toBe(400);
  });
});

describe('Vehicles — Update (PATCH /:id)', () => {
  it('update type → 200', async () => {
    const list = await api('GET', '/api/vehicles?page=1&pageSize=1', undefined, tenantA);
    const id = list.json.items?.[0]?.id;
    if (!id) return;
    const r = await api('PATCH', `/api/vehicles/${id}`, { type: 'Truck' }, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.type).toBe('Truck');
  });
});

describe('Vehicles — Tenant Isolation', () => {
  it('B cannot read A vehicle by ID', async () => {
    const a = await api('GET', '/api/vehicles?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('GET', `/api/vehicles/${id}`, undefined, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });

  it('B cannot update A vehicle', async () => {
    const a = await api('GET', '/api/vehicles?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('PATCH', `/api/vehicles/${id}`, { type: 'Hijack' }, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });

  it('B cannot delete A vehicle', async () => {
    const a = await api('GET', '/api/vehicles?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('DELETE', `/api/vehicles/${id}`, undefined, tenantB);
      expect([400, 403, 404]).toContain(r.status);
    }
  });
});
