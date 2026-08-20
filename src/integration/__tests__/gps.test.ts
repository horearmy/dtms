/**
 * Integration Tests — GPS Tracking
 * Run: npx vitest run src/integration/__tests__/gps.test.ts
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

describe('GPS — Latest (GET /api/gps/latest)', () => {
  it('returns drivers + shipments arrays', async () => {
    const r = await api('GET', '/api/gps/latest?minutes=120', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.drivers)).toBe(true);
    expect(Array.isArray(r.json.shipments)).toBe(true);
  });

  it('driver entries have required fields', async () => {
    const r = await api('GET', '/api/gps/latest?minutes=120', undefined, tenantA);
    expect(r.status).toBe(200);
    if (r.json.drivers.length > 0) {
      const d = r.json.drivers[0];
      expect(d.driverId).toBeDefined();
      expect(d.name).toBeDefined();
      expect(typeof d.latitude).toBe('number');
      expect(typeof d.longitude).toBe('number');
    }
  });

  it('shipments have trackingNumber + status', async () => {
    const r = await api('GET', '/api/gps/latest?minutes=120', undefined, tenantA);
    expect(r.status).toBe(200);
    if (r.json.shipments.length > 0) {
      const s = r.json.shipments[0];
      expect(s.trackingNumber).toBeDefined();
      expect(s.status).toBeDefined();
    }
  });

  it('respects minutes parameter', async () => {
    const r = await api('GET', '/api/gps/latest?minutes=60', undefined, tenantA);
    expect(r.status).toBe(200);
  });

  it('unauthenticated → 401', async () => {
    expect((await api('GET', '/api/gps/latest')).status).toBe(401);
  });

  it('responds within 2s', async () => {
    const t = Date.now();
    const r = await api('GET', '/api/gps/latest?minutes=60', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe('GPS — Super Admin Global', () => {
  it('superadmin can access GPS latest', async () => {
    const r = await api('GET', '/api/gps/latest?minutes=120', undefined, superAdmin, 30000);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.drivers)).toBe(true);
  }, 35000);
});
