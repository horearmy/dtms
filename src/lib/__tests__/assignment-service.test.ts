import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockShipment,
  mockDriver,
  mockVehicle,
  mockAssignment,
  mockTransaction,
} = vi.hoisted(() => ({
  mockShipment: { findUnique: vi.fn() },
  mockDriver: { findUnique: vi.fn(), update: vi.fn() },
  mockVehicle: { findUnique: vi.fn(), update: vi.fn() },
  mockAssignment: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shipment: mockShipment,
    driver: mockDriver,
    vehicle: mockVehicle,
    deliveryAssignment: mockAssignment,
    $transaction: mockTransaction,
  },
}));
vi.mock('@/lib/whatsapp', () => ({ isWhatsAppEnabled: () => false, sendTextMessage: vi.fn() }));

import { createAssignment } from '@/lib/assignment-service';

const SHIPMENT = { id: 's2', branchId: null, status: 'WAREHOUSE_RECEIVED' };
const DRIVER = { id: 'd1', name: 'Budi', status: 'ACTIVE', returning: false };
const VEHICLE = { id: 'v1', vehicleNumber: 'B 1234 CD', status: 'AVAILABLE', returning: false };
const OPEN = { shipment: { trackingNumber: 'DTMS-2026-000001' } };

describe('createAssignment — anti double-booking (satu driver/kendaraan utk satu trip terbuka)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('menolak menugaskan driver yang masih punya pengiriman terbuka (400)', async () => {
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockVehicle.findUnique.mockResolvedValue(VEHICLE);
    mockAssignment.findFirst
      .mockResolvedValueOnce(OPEN)  // driverOpenTrip
      .mockResolvedValueOnce(null); // vehicleOpenTrip

    const res = await createAssignment({ shipmentId: 's2', driverId: 'd1', vehicleId: 'v1', requireShipmentAssignable: false });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error).toContain('pengiriman terbuka');
    }
  });

  it('menolak menugaskan kendaraan yang masih dipakai trip terbuka (400)', async () => {
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockVehicle.findUnique.mockResolvedValue(VEHICLE);
    mockAssignment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(OPEN); // vehicleOpenTrip

    const res = await createAssignment({ shipmentId: 's2', driverId: 'd1', vehicleId: 'v1', requireShipmentAssignable: false });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.error).toContain('masih dipakai resi');
    }
  });

  it('mengizinkan menugaskan driver yang hanya punya trip tertutup (DELIVERED)', async () => {
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockVehicle.findUnique.mockResolvedValue(VEHICLE);
    mockAssignment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockAssignment.create.mockResolvedValue({ id: 'a9', shipmentId: 's2', driverId: 'd1', vehicleId: 'v1' });
    mockTransaction.mockImplementation(async (cb) =>
      cb({ driver: mockDriver, vehicle: mockVehicle, deliveryAssignment: mockAssignment })
    );

    const res = await createAssignment({ shipmentId: 's2', driverId: 'd1', vehicleId: 'v1', requireShipmentAssignable: false });
    expect(res.ok).toBe(true);
  });
});
