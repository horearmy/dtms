import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockDriver,
  mockShipment,
  mockAssignment,
  mockVehicle,
  mockWarehouseScan,
  mockTrackingEvent,
  mockNotification,
  mockTransaction,
  mockGuard,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockDriver: { findUnique: vi.fn() },
  mockShipment: { findUnique: vi.fn(), update: vi.fn() },
  mockAssignment: { findFirst: vi.fn() },
  mockVehicle: { findUnique: vi.fn() },
  mockWarehouseScan: { create: vi.fn() },
  mockTrackingEvent: { create: vi.fn() },
  mockNotification: { create: vi.fn() },
  mockTransaction: vi.fn(),
  mockGuard: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    driver: mockDriver,
    shipment: mockShipment,
    deliveryAssignment: mockAssignment,
    vehicle: mockVehicle,
    warehouseScan: mockWarehouseScan,
    trackingEvent: mockTrackingEvent,
    notification: mockNotification,
    $transaction: mockTransaction,
  },
}));
vi.mock('@/lib/api-guard', () => ({ guard: mockGuard, guardPermission: mockGuard, logAudit: mockLogAudit, runWithTenant: (_tenantId: string | null | undefined, fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/whatsapp', () => ({ isWhatsAppEnabled: () => false }));

import { POST } from '../dispatch-driver/route';

const SESSION = { id: 'u1', name: 'Staff Gudang', username: 'staff', role: 'WAREHOUSE' };

const DRIVER = { id: 'd1', employeeId: 'DRV001', name: 'Budi', tenantId: 't1' };
const ASSIGNMENT = { id: 'a1', shipmentId: 's1', driverId: 'd1', vehicleId: 'v1' };
const SHIPMENT = { id: 's1', trackingNumber: 'DTMS-2026-000001', status: 'WAREHOUSE_RECEIVED', tenantId: 't1' };
const VEHICLE = { id: 'v1', status: 'AVAILABLE', returning: false };

function dispatchReq(body: unknown) {
  return new NextRequest('http://localhost:3001/api/warehouse/dispatch-driver', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockTx() {
  mockTransaction.mockImplementation(async (cb) =>
    cb({ shipment: mockShipment, trackingEvent: mockTrackingEvent, notification: mockNotification, warehouseScan: mockWarehouseScan })
  );
}

describe('POST /api/warehouse/dispatch-driver', () => {
  beforeEach(() => vi.clearAllMocks());

  it('menolak tanpa sesi (401)', async () => {
    mockGuard.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Tidak terautentikasi' }), { status: 401 }),
    });
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(401);
  });

  it('menolak format QR tidak valid (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    const res = await POST(dispatchReq({ code: 'RANDOM-CODE' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Format QR');
  });

  it('menolak driver tidak ditemukan (404)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(null);
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(404);
  });

  it('menolak shipment tidak ditemukan (404)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue(null);
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(404);
  });

  it('menolak shipment sudah DISPATCHED (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue({ ...SHIPMENT, status: 'DISPATCHED' });
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sudah diberangkatkan');
  });

  it('menolak status belum siap (ORDER_CREATED) (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue({ ...SHIPMENT, status: 'ORDER_CREATED' });
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('belum siap diberangkatkan');
  });

  it('menolak tanpa assignment (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue(null);
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Lengkapi penugasan');
  });

  it('menolak driver QR tidak cocok dengan driver yang ditugaskan (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue({ ...ASSIGNMENT, driverId: 'd2' });
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('tidak cocok');
  });

  it('menolak kendaraan MAINTENANCE (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue(ASSIGNMENT);
    mockVehicle.findUnique.mockResolvedValue({ ...VEHICLE, status: 'MAINTENANCE' });
    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Kendaraan tidak tersedia');
  });

  it('berhasil memberangkatkan saat driver cocok (200)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue(ASSIGNMENT);
    mockVehicle.findUnique.mockResolvedValue(VEHICLE);
    mockTx();
    mockTrackingEvent.create.mockResolvedValue({ id: 'e1' });
    mockShipment.update.mockResolvedValue({ ...SHIPMENT, status: 'DISPATCHED' });
    mockNotification.create.mockResolvedValue({ id: 'n1' });
    mockWarehouseScan.create.mockResolvedValue({ id: 'sc1' });

    const res = await POST(dispatchReq({ code: 'DRV:DRV001:SHP:s1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shipment.status).toBe('DISPATCHED');
    expect(mockShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DISPATCHED' }) })
    );
    expect(mockWarehouseScan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DISPATCHED', scannedBy: 'u1', notes: expect.stringContaining('DRV001') }),
      })
    );
    expect(mockTrackingEvent.create).toHaveBeenCalled();
    expect(mockNotification.create).toHaveBeenCalled();
  });
});
