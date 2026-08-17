import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDeliveryAssignment = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    deliveryAssignment: mockDeliveryAssignment,
  },
}));

import { driverScore } from '../scoring';

beforeEach(() => vi.clearAllMocks());

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    driverId: 'd1',
    shipment: {
      status: 'DELIVERED',
      slaDeadline: new Date('2026-08-14T21:00:00Z'),
      updatedAt: new Date('2026-08-14T20:00:00Z'),
      pods: [{ deliveredAt: new Date('2026-08-14T19:30:00Z') }],
      ...((overrides.shipment as Record<string, unknown>) || {}),
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'shipment')),
  };
}

describe('driverScore', () => {
  it('driver tanpa assignment -> score 0', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([]);
    const result = await driverScore('d1');
    expect(result).toEqual({ score: 0, total: 0, delivered: 0, onTime: 0, failed: 0 });
  });

  it('semua delivered on-time tanpa gagal -> score maksimal', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment(),
      makeAssignment(),
      makeAssignment(),
    ]);
    const result = await driverScore('d1');
    expect(result.total).toBe(3);
    expect(result.delivered).toBe(3);
    expect(result.onTime).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.score).toBe(80);
  });

  it('semua delivered tapi terlambat -> score lebih rendah', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment({ shipment: { pods: [{ deliveredAt: new Date('2026-08-15T00:00:00Z') }] } }),
      makeAssignment({ shipment: { pods: [{ deliveredAt: new Date('2026-08-15T01:00:00Z') }] } }),
    ]);
    const result = await driverScore('d1');
    expect(result.delivered).toBe(2);
    expect(result.onTime).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.score).toBe(50);
  });

  it('ada delivery gagal -> failFactor menurunkan skor', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment(),
      makeAssignment({ shipment: { status: 'DELIVERY_FAILED', pods: [] } }),
    ]);
    const result = await driverScore('d1');
    expect(result.failed).toBe(1);
    expect(result.score).toBeLessThan(52);
  });

  it('semua gagal -> score rendah karena failFactor', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment({ shipment: { status: 'DELIVERY_FAILED', pods: [] } }),
      makeAssignment({ shipment: { status: 'RETURNED', pods: [] } }),
    ]);
    const result = await driverScore('d1');
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.score).toBe(0);
  });

  it('mix delivered + failed', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment(),
      makeAssignment(),
      makeAssignment({ shipment: { status: 'DELIVERY_FAILED', pods: [] } }),
    ]);
    const result = await driverScore('d1');
    expect(result.delivered).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.score).toBe(41);
  });

  it('delivered tanpa pod -> pakai updatedAt sebagai waktu selesai', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment({ shipment: { pods: [], updatedAt: new Date('2026-08-14T20:00:00Z') } }),
    ]);
    const result = await driverScore('d1');
    expect(result.delivered).toBe(1);
    expect(result.onTime).toBe(1);
  });

  it('RETURNED dihitung sebagai gagal', async () => {
    mockDeliveryAssignment.findMany.mockResolvedValue([
      makeAssignment(),
      makeAssignment({ shipment: { status: 'RETURNED', pods: [] } }),
    ]);
    const result = await driverScore('d1');
    expect(result.failed).toBe(1);
  });
});
