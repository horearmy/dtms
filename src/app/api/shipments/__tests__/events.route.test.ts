import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockShipment,
  mockDriver,
  mockAssignment,
  mockVehicle,
  mockTrackingEvent,
  mockNotification,
  mockTransaction,
  mockGuard,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockShipment: { findUnique: vi.fn(), update: vi.fn() },
  mockDriver: { findUnique: vi.fn() },
  mockAssignment: { findFirst: vi.fn() },
  mockVehicle: { findUnique: vi.fn() },
  mockTrackingEvent: { create: vi.fn() },
  mockNotification: { create: vi.fn() },
  mockTransaction: vi.fn(),
  mockGuard: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shipment: mockShipment,
    driver: mockDriver,
    deliveryAssignment: mockAssignment,
    vehicle: mockVehicle,
    trackingEvent: mockTrackingEvent,
    notification: mockNotification,
    $transaction: mockTransaction,
  },
}));
vi.mock('@/lib/api-guard', () => ({ guard: mockGuard, guardPermission: mockGuard, logAudit: mockLogAudit, runWithTenant: (_t: string | null | undefined, fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/whatsapp', () => ({ isWhatsAppEnabled: () => false, sendShipmentStatusUpdate: vi.fn(), sendDeliveryFailedAlert: vi.fn() }));

import { POST } from '../[id]/events/route';

const ADMIN = { id: 'u9', name: 'Admin', username: 'admin', role: 'ADMIN', tenantId: 't1' };
const DRIVER_SESSION = { id: 'u1', name: 'Budi', username: 'budi', role: 'DRIVER', tenantId: 't1' };

function eventsReq(body: unknown) {
  return new NextRequest('http://localhost:3001/api/shipments/s1/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockTx() {
  mockTransaction.mockImplementation(async (cb) =>
    cb({ shipment: mockShipment, trackingEvent: mockTrackingEvent, notification: mockNotification })
  );
}

describe('POST /api/shipments/[id]/events — admin hanya memantau', () => {
  beforeEach(() => vi.clearAllMocks());

  it('admin tidak bisa memajukan status perjalanan (403)', async () => {
    mockGuard.mockResolvedValue({ session: ADMIN, error: null });
    mockShipment.findUnique.mockResolvedValue({ id: 's1', status: 'DISPATCHED', trackingNumber: 'X-1' });
    const res = await POST(eventsReq({ status: 'IN_TRANSIT' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('tidak dapat diubah manual');
  });

  it('admin dapat menandai DELIVERY_FAILED (200)', async () => {
    mockGuard.mockResolvedValue({ session: ADMIN, error: null });
    mockShipment.findUnique.mockResolvedValue({ id: 's1', status: 'OUT_FOR_DELIVERY', trackingNumber: 'X-1' });
    mockTx();
    mockTrackingEvent.create.mockResolvedValue({ id: 'e1' });
    mockShipment.update.mockResolvedValue({ id: 's1', status: 'DELIVERY_FAILED' });
    mockNotification.create.mockResolvedValue({ id: 'n1' });

    const res = await POST(eventsReq({ status: 'DELIVERY_FAILED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('driver dapat maju sesuai alur DRIVER_FLOW (200)', async () => {
    mockGuard.mockResolvedValue({ session: DRIVER_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue({ id: 's1', status: 'IN_TRANSIT', trackingNumber: 'X-1' });
    mockDriver.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1' });
    mockAssignment.findFirst.mockResolvedValue({ shipmentId: 's1', driverId: 'd1', vehicleId: 'v1' });
    mockTx();
    mockTrackingEvent.create.mockResolvedValue({ id: 'e1' });
    mockShipment.update.mockResolvedValue({ id: 's1', status: 'ARRIVED_AT_HUB' });
    mockNotification.create.mockResolvedValue({ id: 'n1' });

    const res = await POST(eventsReq({ status: 'ARRIVED_AT_HUB' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
  });

  it('driver dapat melaporkan DELIVERY_FAILED saat on-road (200)', async () => {
    mockGuard.mockResolvedValue({ session: DRIVER_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue({ id: 's1', status: 'OUT_FOR_DELIVERY', trackingNumber: 'X-1' });
    mockDriver.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1' });
    mockAssignment.findFirst.mockResolvedValue({ shipmentId: 's1', driverId: 'd1', vehicleId: 'v1' });
    mockTx();
    mockTrackingEvent.create.mockResolvedValue({ id: 'e1' });
    mockShipment.update.mockResolvedValue({ id: 's1', status: 'DELIVERY_FAILED' });
    mockNotification.create.mockResolvedValue({ id: 'n1' });

    const res = await POST(
      eventsReq({ status: 'DELIVERY_FAILED', notes: 'Penerima tidak berada di lokasi' }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shipment.status).toBe('DELIVERY_FAILED');
  });

  it('driver dapat melaporkan RESCHEDULED saat on-road (200)', async () => {
    mockGuard.mockResolvedValue({ session: DRIVER_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue({ id: 's1', status: 'IN_TRANSIT', trackingNumber: 'X-1' });
    mockDriver.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1' });
    mockAssignment.findFirst.mockResolvedValue({ shipmentId: 's1', driverId: 'd1', vehicleId: 'v1' });
    mockTx();
    mockTrackingEvent.create.mockResolvedValue({ id: 'e1' });
    mockShipment.update.mockResolvedValue({ id: 's1', status: 'RESCHEDULED' });
    mockNotification.create.mockResolvedValue({ id: 'n1' });

    const res = await POST(eventsReq({ status: 'RESCHEDULED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
  });

  it('driver TIDAK bisa melaporkan DELIVERY_FAILED saat belum on-road (400)', async () => {
    mockGuard.mockResolvedValue({ session: DRIVER_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue({ id: 's1', status: 'WAREHOUSE_RECEIVED', trackingNumber: 'X-1' });
    mockDriver.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1' });
    mockAssignment.findFirst.mockResolvedValue({ shipmentId: 's1', driverId: 'd1', vehicleId: 'v1' });

    const res = await POST(eventsReq({ status: 'DELIVERY_FAILED' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('saat pengiriman berlangsung');
  });
});
