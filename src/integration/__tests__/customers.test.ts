/**
 * Integration Tests — Customers CRUD + Validation
 * Run: npx vitest run src/integration/__tests__/customers.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, TENANT_A_ID, TENANT_B_ID } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;
let tenantB: ReturnType<typeof getAuth>;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
  tenantB = getAuth('tenantB');
});

describe('Customers — List (GET)', () => {
  it('returns paginated customers', async () => {
    const r = await api('GET', '/api/customers?page=1&pageSize=5', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items).toBeDefined();
    expect(r.json.total).toBeGreaterThan(0);
  });

  it('each item has _count with sentBy and receivedBy', async () => {
    const r = await api('GET', '/api/customers?page=1&pageSize=3', undefined, tenantA);
    expect(r.status).toBe(200);
    for (const c of r.json.items) {
      expect(c._count).toBeDefined();
      expect(typeof c._count.sentBy).toBe('number');
      expect(typeof c._count.receivedBy).toBe('number');
    }
  });

  it('search by name', async () => {
    const list = await api('GET', '/api/customers?page=1&pageSize=1', undefined, tenantA);
    const name = list.json.items?.[0]?.name;
    if (!name) return;
    const q = name.slice(0, 4);
    const r = await api('GET', `/api/customers?q=${encodeURIComponent(q)}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThan(0);
  });

  it('all items scoped to tenant', async () => {
    const r = await api('GET', '/api/customers?page=1&pageSize=50', undefined, tenantA);
    expect(r.status).toBe(200);
    for (const c of r.json.items) expect(c.tenantId).toBe(TENANT_A_ID);
  });
});

describe('Customers — Create (POST)', () => {
  it('valid data → 201', async () => {
    const r = await api('POST', '/api/customers', {
      name: 'Integ Customer',
      phone: '081234567890',
      email: 'integ@test.com',
      city: 'Jakarta',
      postalCode: '12345',
    }, tenantA);
    expect(r.status).toBe(201);
    expect(r.json.id).toBeDefined();
    expect(r.json.name).toBe('Integ Customer');
    expect(r.json.city).toBe('Jakarta');
  });

  it('minimal data (name + phone only) → 201', async () => {
    const r = await api('POST', '/api/customers', {
      name: 'Minimal',
      phone: '081111111111',
    }, tenantA);
    expect(r.status).toBe(201);
  });

  it('missing name → 400', async () => {
    const r = await api('POST', '/api/customers', { phone: '081' }, tenantA);
    expect(r.status).toBe(400);
  });

  it('missing phone → 400', async () => {
    const r = await api('POST', '/api/customers', { name: 'X' }, tenantA);
    expect(r.status).toBe(400);
  });

  it('empty body → 400', async () => {
    const r = await api('POST', '/api/customers', {}, tenantA);
    expect(r.status).toBe(400);
  });
});

describe('Customers — Update (PATCH /:id)', () => {
  it('update name → 200', async () => {
    const list = await api('GET', '/api/customers?page=1&pageSize=1', undefined, tenantA);
    const id = list.json.items?.[0]?.id;
    if (!id) return;
    const r = await api('PATCH', `/api/customers/${id}`, { name: 'Updated Customer' }, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.name).toBe('Updated Customer');
  });

  it('update nonexistent → 404', async () => {
    const r = await api('PATCH', '/api/customers/00000000-0000-0000-0000-000000000000', { name: 'X' }, tenantA);
    expect(r.status).toBe(404);
  });
});

describe('Customers — Delete (DELETE /:id)', () => {
  it('delete nonexistent → 400/404', async () => {
    const r = await api('DELETE', '/api/customers/00000000-0000-0000-0000-000000000000', undefined, tenantA);
    expect([400, 404]).toContain(r.status);
  });
});

describe('Customers — Tenant Isolation', () => {
  it('B cannot read A customer by ID', async () => {
    const a = await api('GET', '/api/customers?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('GET', `/api/customers/${id}`, undefined, tenantB);
      expect([403, 404, 405]).toContain(r.status);
    }
  });

  it('B cannot update A customer', async () => {
    const a = await api('GET', '/api/customers?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('PATCH', `/api/customers/${id}`, { name: 'Hijack' }, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });

  it('B cannot delete A customer', async () => {
    const a = await api('GET', '/api/customers?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('DELETE', `/api/customers/${id}`, undefined, tenantB);
      expect([400, 403, 404]).toContain(r.status);
    }
  });
});
