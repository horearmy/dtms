/**
 * Integration Tests — Shipments CRUD + Validation
 * Run: npx vitest run src/integration/__tests__/shipments.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, TENANT_A_ID, TENANT_B_ID } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;
let tenantB: ReturnType<typeof getAuth>;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
  tenantB = getAuth('tenantB');
});

describe('Shipments — List (GET)', () => {
  it('returns paginated shipments', async () => {
    const r = await api('GET', '/api/shipments?page=1&pageSize=5', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items).toBeDefined();
    expect(r.json.total).toBeGreaterThan(0);
    expect(r.json.items.length).toBeLessThanOrEqual(5);
  });

  it('search by tracking number', async () => {
    const list = await api('GET', '/api/shipments?page=1&pageSize=1', undefined, tenantA);
    const tn = list.json.items?.[0]?.trackingNumber;
    if (!tn) return;
    const q = tn.slice(0, 8);
    const r = await api('GET', `/api/shipments?q=${encodeURIComponent(q)}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThan(0);
  });

  it('all items scoped to tenant', async () => {
    const r = await api('GET', '/api/shipments?page=1&pageSize=50', undefined, tenantA);
    expect(r.status).toBe(200);
    for (const s of r.json.items) expect(s.tenantId).toBe(TENANT_A_ID);
  });

  it('unauthenticated → 401', async () => {
    expect((await api('GET', '/api/shipments')).status).toBe(401);
  });
});

describe('Shipments — Detail (GET /:id)', () => {
  it('valid ID returns shipment', async () => {
    const list = await api('GET', '/api/shipments?page=1&pageSize=1', undefined, tenantA);
    const id = list.json.items?.[0]?.id;
    if (!id) return;
    const r = await api('GET', `/api/shipments/${id}`, undefined, tenantA);
    expect(r.status).toBe(200);
    expect(r.json.id).toBe(id);
    expect(r.json.trackingNumber).toBeDefined();
  });

  it('nonexistent ID → 404', async () => {
    const r = await api('GET', '/api/shipments/00000000-0000-0000-0000-000000000000', undefined, tenantA);
    expect(r.status).toBe(404);
  });
});

describe('Shipments — Create (POST)', () => {
  let senderId = '';
  let receiverId = '';

  it('setup: get customer IDs', async () => {
    const r = await api('GET', '/api/customers?page=1&pageSize=2', undefined, tenantA);
    expect(r.status).toBe(200);
    senderId = r.json.items?.[0]?.id;
    receiverId = r.json.items?.[1]?.id || r.json.items?.[0]?.id;
    expect(senderId).toBeDefined();
  });

  it('valid data with sender/receiver → 201', async () => {
    if (!senderId || !receiverId) return;
    const r = await api('POST', '/api/shipments', {
      senderId,
      receiverId,
      weight: 5,
      origin: 'Jakarta',
      destination: 'Bandung',
      itemName: 'Dokumen',
      itemCount: 1,
    }, tenantA);
    expect(r.status).toBe(201);
    expect(r.json.id).toBeDefined();
    expect(r.json.trackingNumber).toBeDefined();
    expect(r.json.status).toBe('ORDER_CREATED');
  });

  it('missing weight → 400', async () => {
    if (!senderId || !receiverId) return;
    const r = await api('POST', '/api/shipments', { senderId, receiverId }, tenantA);
    expect(r.status).toBe(400);
    expect(r.json.error).toContain('Berat');
  });

  it('missing sender/receiver → 400', async () => {
    const r = await api('POST', '/api/shipments', { weight: 5 }, tenantA);
    expect(r.status).toBe(400);
  });

  it('empty body → 400', async () => {
    const r = await api('POST', '/api/shipments', {}, tenantA);
    expect(r.status).toBe(400);
  });
});

describe('Shipments — Tenant Isolation', () => {
  it('B cannot read A shipment by ID', async () => {
    const a = await api('GET', '/api/shipments?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('GET', `/api/shipments/${id}`, undefined, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });

  it('B sees only B shipments', async () => {
    const r = await api('GET', '/api/shipments?page=1&pageSize=20', undefined, tenantB);
    expect(r.status).toBe(200);
    for (const s of r.json.items) expect(s.tenantId).toBe(TENANT_B_ID);
  });

  it('IDOR: B cannot read A shipment detail', async () => {
    const a = await api('GET', '/api/shipments?page=1&pageSize=1', undefined, tenantA);
    const id = a.json.items?.[0]?.id;
    if (id) {
      const r = await api('GET', `/api/shipments/${id}`, undefined, tenantB);
      expect([403, 404]).toContain(r.status);
    }
  });
});
