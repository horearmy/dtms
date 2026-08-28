import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockShipment,
  mockDriver,
  mockAssignment,
  mockProofOfDelivery,
  mockTrackingEvent,
  mockNotification,
  mockTransaction,
  mockGuard,
  mockLogAudit,
} = vi.hoisted(() => ({
  mockShipment: { findUnique: vi.fn(), update: vi.fn() },
  mockDriver: { findUnique: vi.fn() },
  mockAssignment: { findFirst: vi.fn() },
  mockProofOfDelivery: { create: vi.fn() },
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
    proofOfDelivery: mockProofOfDelivery,
    trackingEvent: mockTrackingEvent,
    notification: mockNotification,
    $transaction: mockTransaction,
  },
}));
vi.mock('@/lib/api-guard', () => ({ guard: mockGuard, guardPermission: mockGuard, logAudit: mockLogAudit, runWithTenant: (_t: string | null | undefined, fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/whatsapp', () => ({ sendShipmentStatusUpdate: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { POST } from '../[id]/pod/route';

const DRIVER_SESSION = { id: 'u1', name: 'Budi', username: 'budi', role: 'DRIVER', tenantId: 't1' };
const ADMIN_SESSION = { id: 'u2', name: 'Admin', username: 'admin', role: 'WAREHOUSE', tenantId: 't1' };

const SHIPMENT = {
  id: 's1',
  trackingNumber: 'DTMS-2026-000001',
  status: 'OUT_FOR_DELIVERY',
  destination: 'Jakarta',
  tenantId: 't1',
  receiver: { name: 'Rina', phone: '0812' },
};
const DRIVER = { id: 'd1', name: 'Budi', employeeId: 'DRV001', userId: 'u1' };
const ASSIGNMENT = { id: 'a1', shipmentId: 's1', driverId: 'd1', vehicleId: 'v1' };

function podReq(body: unknown) {
  return new NextRequest('http://localhost:3001/api/shipments/s1/pod', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/shipments/[id]/pod — driver-only completion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('menolak non-driver menyelesaikan pengiriman (403)', async () => {
    mockGuard.mockResolvedValue({ session: ADMIN_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    const res = await POST(podReq({ receiverName: 'Rina' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('hanya dapat dilakukan oleh driver');
  });

  it('menolak driver yang tidak ditugaskan (403)', async () => {
    mockGuard.mockResolvedValue({ session: DRIVER_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockAssignment.findFirst.mockResolvedValue(null);
    const res = await POST(podReq({ receiverName: 'Rina' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('bukan tugas Anda');
  });

  it('driver yang ditugaskan berhasil menyelesaikan delivery (200)', async () => {
    mockGuard.mockResolvedValue({ session: DRIVER_SESSION, error: null });
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockAssignment.findFirst.mockResolvedValue(ASSIGNMENT);
    mockTransaction.mockImplementation(async (cb) => cb({
      proofOfDelivery: mockProofOfDelivery,
      shipment: mockShipment,
      trackingEvent: mockTrackingEvent,
      notification: mockNotification,
    }));

    const res = await POST(podReq({ receiverName: 'Rina', notes: 'diterima' }), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DELIVERED' }) })
    );
  });
});
