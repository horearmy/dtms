import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockShipment,
  mockDriver,
  mockNotification,
} = vi.hoisted(() => ({
  mockShipment: { findMany: vi.fn() },
  mockDriver: { findMany: vi.fn() },
  mockNotification: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock('../prisma', () => ({
  prisma: {
    shipment: mockShipment,
    driver: mockDriver,
    notification: mockNotification,
  },
}));

import { scanAlerts } from '../alerts';

const NOW = new Date('2026-08-14T12:00:00Z');
beforeEach(() => vi.setSystemTime(NOW));
beforeEach(() => vi.clearAllMocks());

describe('scanAlerts - SLA', () => {
  it('membuat notifikasi SLA untuk shipment yang melewati deadline (non DELIVERED/RETURNED)', async () => {
    mockShipment.findMany.mockResolvedValue([
      {
        id: 's1',
        trackingNumber: 'DTMS-2026-000001',
        status: 'IN_TRANSIT',
        slaDeadline: new Date('2026-08-14T09:00:00Z'), // 3 jam lalu
        receiver: { name: 'Andi' },
      },
    ]);
    mockNotification.findFirst.mockResolvedValue(null);
    mockDriver.findMany.mockResolvedValue([]);

    const created = await scanAlerts();

    expect(created).toBe(1);
    expect(mockNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining('SLA Terlambat: DTMS-2026-000001'),
          userId: null,
        }),
      })
    );
  });

  it('tidak membuat duplikat SLA jika sudah ada notifikasi dengan prefix yang sama', async () => {
    mockShipment.findMany.mockResolvedValue([
      {
        id: 's1',
        trackingNumber: 'DTMS-2026-000001',
        status: 'IN_TRANSIT',
        slaDeadline: new Date('2026-08-14T09:00:00Z'),
        receiver: { name: 'Andi' },
      },
    ]);
    mockNotification.findFirst.mockResolvedValue({ id: 'existing', createdAt: new Date('2026-08-14T10:00:00Z') });
    mockDriver.findMany.mockResolvedValue([]); // tanpa driver stale

    const created = await scanAlerts();
    expect(created).toBe(0);
    expect(mockNotification.create).not.toHaveBeenCalled();
  });

  it('melewati shipment DELIVERED/RETURNED', async () => {
    mockShipment.findMany.mockResolvedValue([
      { id: 's1', status: 'DELIVERED', slaDeadline: new Date('2026-08-14T09:00:00Z'), receiver: { name: 'Andi' } },
      { id: 's2', status: 'RETURNED', slaDeadline: new Date('2026-08-14T09:00:00Z'), receiver: { name: 'Budi' } },
    ]);
    mockDriver.findMany.mockResolvedValue([]);
    const created = await scanAlerts();
    expect(created).toBe(0);
  });
});

describe('scanAlerts - GPS putus', () => {
  it('membuat notifikasi GPS untuk driver yang GPS-nya stale > 30 menit', async () => {
    mockShipment.findMany.mockResolvedValue([]);
    mockDriver.findMany.mockResolvedValue([
      {
        id: 'd1',
        name: 'Budi Santoso',
        status: 'ACTIVE',
        gpsLogs: [{ latitude: -6.2, longitude: 106.816, createdAt: new Date(NOW.getTime() - 60 * 60000) }],
      },
    ]);
    mockNotification.findFirst.mockResolvedValue(null);

    const created = await scanAlerts();
    expect(created).toBe(1);
    expect(mockNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining('GPS Driver Terputus: Budi Santoso'),
        }),
      })
    );
  });

  it('tidak memperingatkan driver tanpa GPS log', async () => {
    mockShipment.findMany.mockResolvedValue([]);
    mockDriver.findMany.mockResolvedValue([{ id: 'd1', name: 'Budi', status: 'ACTIVE', gpsLogs: [] }]);
    const created = await scanAlerts();
    expect(created).toBe(0);
    expect(mockNotification.create).not.toHaveBeenCalled();
  });

  it('dedupe GPS 6 jam: tidak membuat notifikasi baru jika sudah ada yang < 6 jam', async () => {
    mockShipment.findMany.mockResolvedValue([]);
    mockDriver.findMany.mockResolvedValue([
      {
        id: 'd1',
        name: 'Budi Santoso',
        status: 'ACTIVE',
        gpsLogs: [{ latitude: -6.2, longitude: 106.816, createdAt: new Date(NOW.getTime() - 60 * 60000) }],
      },
    ]);
    mockNotification.findFirst.mockResolvedValue({ id: 'existing', createdAt: new Date(NOW.getTime() - 3600000) }); // 1 jam lalu

    const created = await scanAlerts();
    expect(created).toBe(0);
    expect(mockNotification.create).not.toHaveBeenCalled();
  });

  it('membuat notifikasi baru setelah jendela 6 jam lewat', async () => {
    mockShipment.findMany.mockResolvedValue([]);
    mockDriver.findMany.mockResolvedValue([
      {
        id: 'd1',
        name: 'Budi Santoso',
        status: 'ACTIVE',
        gpsLogs: [{ latitude: -6.2, longitude: 106.816, createdAt: new Date(NOW.getTime() - 60 * 60000) }],
      },
    ]);
    mockNotification.findFirst.mockResolvedValue({ id: 'existing', createdAt: new Date(NOW.getTime() - 7 * 3600000) }); // 7 jam lalu

    const created = await scanAlerts();
    expect(created).toBe(1);
  });
});
