import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockShipment,
  mockAssignment,
  mockVehicle,
  mockWarehouseScan,
  mockTrackingEvent,
  mockNotification,
  mockGuard,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockShipment: { findUnique: vi.fn(), update: vi.fn() },
  mockAssignment: { findFirst: vi.fn() },
  mockVehicle: { findUnique: vi.fn() },
  mockWarehouseScan: { create: vi.fn() },
  mockTrackingEvent: { create: vi.fn() },
  mockNotification: { create: vi.fn() },
  mockGuard: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shipment: mockShipment,
    deliveryAssignment: mockAssignment,
    vehicle: mockVehicle,
    warehouseScan: mockWarehouseScan,
    trackingEvent: mockTrackingEvent,
    notification: mockNotification,
  },
}));
vi.mock('@/lib/api-guard', () => ({ guard: mockGuard, guardPermission: mockGuard, logAudit: mockLogAudit, runWithTenant: (_tenantId: string | null | undefined, fn: () => Promise<unknown>) => fn() }));

import { POST } from '../../shipments/[id]/scan/route';

const SESSION = { id: 'u1', name: 'Staff Gudang', username: 'staff', role: 'WAREHOUSE' };

const SHIPMENT = {
  id: 's1',
  trackingNumber: 'DTMS-2026-000001',
  status: 'WAREHOUSE_RECEIVED',
};

function scanReq(body: unknown) {
  return new NextRequest('http://localhost:3001/api/shipments/s1/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/shipments/[id]/scan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('menolak tanpa sesi (401)', async () => {
    mockGuard.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Tidak terautentikasi' }), { status: 401 }),
    });
    const res = await POST(scanReq({ action: 'DISPATCHED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(401);
  });

  it('menolak action di luar ALLOWED (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    const res = await POST(scanReq({ action: 'RETURNED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(400);
  });

  it('menolak shipment tidak ditemukan (404)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(null);
    const res = await POST(scanReq({ action: 'DISPATCHED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(404);
  });

  it('menolak status terminal DELIVERED/RETURNED (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue({ ...SHIPMENT, status: 'DELIVERED' });
    const res = await POST(scanReq({ action: 'DISPATCHED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(400);
  });

  it('menolak transisi status yang tidak valid (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    // ORDER_CREATED tidak bisa langsung DISPATCHED (harus WAREHOUSE_RECEIVED dulu)
    mockShipment.findUnique.mockResolvedValue({ ...SHIPMENT, status: 'ORDER_CREATED' });
    const res = await POST(scanReq({ action: 'DISPATCHED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('tidak valid');
  });

  it('menolak DISPATCHED tanpa assignment driver+vehicle (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue(null);
    const res = await POST(scanReq({ action: 'DISPATCHED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Lengkapi penugasan');
  });

  it('menolak DISPATCHED saat kendaraan MAINTENANCE (400)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue({ driverId: 'd1', vehicleId: 'v1' });
    mockVehicle.findUnique.mockResolvedValue({ id: 'v1', status: 'MAINTENANCE', returning: false });
    const res = await POST(scanReq({ action: 'DISPATCHED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Kendaraan tidak tersedia');
  });

  it('berhasil scan WAREHOUSE_RECEIVED -> DISPATCHED (201)', async () => {
    mockGuard.mockResolvedValue({ session: SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockAssignment.findFirst.mockResolvedValue({ driverId: 'd1', vehicleId: 'v1' });
    mockVehicle.findUnique.mockResolvedValue({ id: 'v1', status: 'AVAILABLE', returning: false });
    mockWarehouseScan.create.mockResolvedValue({ id: 'sc1', action: 'DISPATCHED' });
    mockShipment.update.mockResolvedValue({ ...SHIPMENT, status: 'DISPATCHED' });

    const res = await POST(
      scanReq({ action: 'DISPATCHED', latitude: -6.2, longitude: 106.8, notes: 'muat selesai' }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.shipment.status).toBe('DISPATCHED');
    expect(mockWarehouseScan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DISPATCHED', scannedBy: 'u1' }),
      })
    );
    expect(mockTrackingEvent.create).toHaveBeenCalled();
    expect(mockNotification.create).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      SESSION,
      'WAREHOUSE_SCAN',
      'SHIPMENT',
      expect.objectContaining({ newData: expect.objectContaining({ action: 'DISPATCHED' }) }),
      expect.anything()
    );
  });
});
