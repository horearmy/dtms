import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockDriver,
  mockWarehouse,
  mockAssignment,
  mockVehicle,
  mockVehicleCheck,
  mockNotification,
  mockDailyReport,
  mockTransaction,
  mockGuard,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockDriver: { findUnique: vi.fn(), update: vi.fn() },
  mockWarehouse: { findFirst: vi.fn() },
  mockAssignment: { findFirst: vi.fn(), count: vi.fn() },
  mockVehicle: { update: vi.fn() },
  mockVehicleCheck: { create: vi.fn() },
  mockNotification: { create: vi.fn() },
  mockDailyReport: { upsert: vi.fn() },
  mockTransaction: vi.fn(),
  mockGuard: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    driver: mockDriver,
    warehouse: mockWarehouse,
    deliveryAssignment: mockAssignment,
    vehicle: mockVehicle,
    vehicleCheck: mockVehicleCheck,
    notification: mockNotification,
    dailyReport: mockDailyReport,
    $transaction: mockTransaction,
  },
}));
vi.mock('@/lib/api-guard', () => ({ guard: mockGuard, guardPermission: mockGuard, logAudit: mockLogAudit, runWithTenant: (_tenantId: string | null | undefined, fn: () => Promise<unknown>) => fn() }));

import { POST } from '../return/route';

function returnReq(body: unknown) {
  return new NextRequest('http://localhost:3001/api/driver/return', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockTx() {
  mockTransaction.mockImplementation(async (cb) =>
    cb({
      vehicleCheck: mockVehicleCheck,
      driver: mockDriver,
      vehicle: mockVehicle,
      notification: mockNotification,
    })
  );
}

describe('POST /api/driver/return — konfirmasi tiba (scan gudang + ceklist)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGuard.mockResolvedValue({ session: { id: 'u1', tenantId: 't1' }, error: null });
    mockDriver.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1', returning: true, status: 'ACTIVE' });
    mockWarehouse.findFirst.mockResolvedValue({ id: 'w1', name: 'Gudang Pusat', code: 'WH-001', tenantId: 't1' });
    mockAssignment.findFirst.mockResolvedValue({ vehicleId: 'v1', shipmentId: 's1' });
    mockAssignment.count.mockResolvedValue(0);
    mockDailyReport.upsert.mockResolvedValue({});
    mockTx();
  });

  it('menolak complete tanpa scan gudang (400)', async () => {
    const res = await POST(returnReq({ action: 'complete', answers: {} }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('scan QR gudang');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('menolak complete saat kode gudang tidak valid untuk tenant (404)', async () => {
    mockWarehouse.findFirst.mockResolvedValue(null);
    const res = await POST(returnReq({ action: 'complete', warehouseCode: 'WH-999', answers: {} }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('tidak valid');
  });

  it('complete normal (tanpa masalah) — kendaraan jadi AVAILABLE (200)', async () => {
    mockDailyReport.upsert.mockResolvedValue({});
    const res = await POST(returnReq({ action: 'complete', warehouseCode: 'WH-001', answers: { bodyn: 'ok', rem: 'ok' }, notes: 'Aman' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicleStatus).toBe('AVAILABLE');
    expect(body.issueCount).toBe(0);
    expect(mockVehicleCheck.create).toHaveBeenCalled();
  });

  it('complete dengan masalah — kendaraan jadi MAINTENANCE (200)', async () => {
    mockDailyReport.upsert.mockResolvedValue({});
    const res = await POST(
      returnReq({ action: 'complete', warehouseCode: 'WH-001', answers: { bodyn: 'issue', mesinn: 'issue', rem: 'ok' }, notes: 'Body penyok' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vehicleStatus).toBe('MAINTENANCE');
    expect(body.issueCount).toBe(2);
    expect(mockVehicleCheck.create).toHaveBeenCalled();
    const createCall = mockVehicleCheck.create.mock.calls[0][0] as { data: { hasIssue: boolean; issues: string[] } };
    expect(createCall.data.hasIssue).toBe(true);
    expect(createCall.data.issues).toEqual(['bodyn', 'mesinn']);
  });
});
