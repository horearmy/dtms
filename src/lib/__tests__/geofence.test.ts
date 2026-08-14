import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGeofence,
  mockDriver,
  mockEvent,
  mockNotification,
} = vi.hoisted(() => ({
  mockGeofence: { findMany: vi.fn() },
  mockDriver: { findUnique: vi.fn() },
  mockEvent: { findFirst: vi.fn(), create: vi.fn() },
  mockNotification: { create: vi.fn() },
}));

vi.mock('../prisma', () => ({
  prisma: {
    geofence: mockGeofence,
    driver: mockDriver,
    geofenceEvent: mockEvent,
    notification: mockNotification,
  },
}));

import { checkGeofences } from '../geofence';

const GEOFENCE = {
  id: 'g1',
  name: 'Gudang Pusat Jakarta',
  latitude: -6.213,
  longitude: 106.845,
  radiusMeters: 800,
  active: true,
  type: 'WAREHOUSE',
  description: null,
};

const DRIVER = {
  id: 'd1',
  name: 'Budi Santoso',
  userId: 'u1',
};

describe('checkGeofences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('membuat event ENTER + notifikasi saat driver masuk area dari luar', async () => {
    mockGeofence.findMany.mockResolvedValue([GEOFENCE]);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockEvent.findFirst.mockResolvedValue(null); // belum ada event

    const created = await checkGeofences('d1', -6.213, 106.845); // persis di tengah

    expect(created).toEqual([{ geofence: 'Gudang Pusat Jakarta', type: 'ENTER' }]);
    expect(mockEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          geofenceId: 'g1',
          driverId: 'd1',
          eventType: 'ENTER',
        }),
      })
    );
    expect(mockNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining('masuk perimeter'),
          userId: 'u1',
        }),
      })
    );
  });

  it('tidak membuat event baru jika sudah di dalam (terakhir ENTER)', async () => {
    mockGeofence.findMany.mockResolvedValue([GEOFENCE]);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockEvent.findFirst.mockResolvedValue({ eventType: 'ENTER', id: 'e1' });

    const created = await checkGeofences('d1', -6.213, 106.845);
    expect(created).toEqual([]);
    expect(mockEvent.create).not.toHaveBeenCalled();
  });

  it('membuat event EXIT saat driver keluar area (terakhir ENTER)', async () => {
    mockGeofence.findMany.mockResolvedValue([GEOFENCE]);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    mockEvent.findFirst.mockResolvedValue({ eventType: 'ENTER', id: 'e1' });

    // ~3 km jauhnya dari pusat gudang (radius 800m) → di luar
    const created = await checkGeofences('d1', -6.24, 106.87);
    expect(created).toEqual([{ geofence: 'Gudang Pusat Jakarta', type: 'EXIT' }]);
    expect(mockEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'EXIT' }),
      })
    );
  });

  it('mengabaikan geofence non-aktif', async () => {
    mockGeofence.findMany.mockResolvedValue([{ ...GEOFENCE, active: false }]);
    mockDriver.findUnique.mockResolvedValue(DRIVER);
    const created = await checkGeofences('d1', -6.213, 106.845);
    expect(created).toEqual([]);
  });

  it('tidak crash jika driver tidak ditemukan', async () => {
    mockGeofence.findMany.mockResolvedValue([GEOFENCE]);
    mockDriver.findUnique.mockResolvedValue(null);
    const created = await checkGeofences('d1', -6.213, 106.845);
    expect(created).toEqual([]);
    expect(mockEvent.create).not.toHaveBeenCalled();
  });
});
