/**
 * Integration Tests — Dashboard & Stats
 * Run: npx vitest run src/integration/__tests__/dashboard.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getAuth, api, TENANT_A_ID } from '../helpers';

let tenantA: ReturnType<typeof getAuth>;

beforeAll(async () => {
  tenantA = getAuth('tenantA');
});

describe('Dashboard — Control Tower', () => {
  it('returns 200 with stats', async () => {
    const r = await api('GET', '/api/control-tower', undefined, tenantA);
    expect(r.status).toBe(200);
  });

  it('unauthenticated → 401', async () => {
    expect((await api('GET', '/api/control-tower')).status).toBe(401);
  });
});

describe('Dashboard — Notifications', () => {
  it('returns 200 with items + unread count', async () => {
    const r = await api('GET', '/api/notifications', undefined, tenantA);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.items)).toBe(true);
    expect(typeof r.json.unread).toBe('number');
  });

  it('unauthenticated → 401', async () => {
    expect((await api('GET', '/api/notifications')).status).toBe(401);
  });
});

describe('Dashboard — Audit', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/audit', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Dispatch', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/dispatch', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Daily Reports', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/daily-reports', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Exceptions', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/exceptions', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — SLA', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/sla-policies', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Geofences', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/geofences', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Messages', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/messages', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Warehouse Scans', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/warehouse/scans', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Files', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/files', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Webhooks', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/webhooks', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — Integrations', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/integrations', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('Dashboard — API Keys', () => {
  it('returns 200', async () => {
    const r = await api('GET', '/api/api-keys', undefined, tenantA);
    expect(r.status).toBe(200);
  });
});

describe('All core endpoints — Unauthenticated check', () => {
  const endpoints = [
    '/api/drivers',
    '/api/vehicles',
    '/api/customers',
    '/api/shipments',
    '/api/gps/latest',
    '/api/notifications',
    '/api/control-tower',
    '/api/geofences',
    '/api/webhooks',
    '/api/integrations',
    '/api/api-keys',
  ];

  for (const ep of endpoints) {
    it(`${ep} → 401 without auth`, async () => {
      const r = await api('GET', ep);
      expect(r.status).toBe(401);
    });
  }
});
