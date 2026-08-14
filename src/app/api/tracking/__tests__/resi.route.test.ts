import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockShipment = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { shipment: mockShipment },
}));

import { GET } from '../[resi]/route';

const RESI = 'DTMS-2026-000001';

const SHIPMENT = {
  trackingNumber: RESI,
  status: 'IN_TRANSIT',
  origin: 'Jakarta',
  destination: 'Bandung',
  serviceType: 'SAME_DAY',
  createdAt: new Date('2026-08-14T08:00:00Z'),
  sender: { name: 'VG Sender' },
  receiver: { name: 'Andi Pratama' },
  events: [
    { status: 'DISPATCHED', notes: 'Berangkat', latitude: null, longitude: null, createdAt: new Date('2026-08-14T08:10:00Z') },
  ],
  pods: [],
  assignments: [
    {
      driver: { name: 'Budi Santoso' },
      vehicle: { vehicleNumber: 'B 5678 EF' },
    },
  ],
};

function resiReq(resi: string) {
  return {
    params: Promise.resolve({ resi }),
  };
}

describe('GET /api/tracking/[resi]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mengembalikan data shipment untuk resi yang valid', async () => {
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    const res = await GET({} as never, resiReq(RESI));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trackingNumber).toBe(RESI);
    expect(body.status).toBe('IN_TRANSIT');
    expect(body.driver).toBe('Budi Santoso');
    expect(body.vehicle).toBe('B 5678 EF');
    expect(body.receiver.name).toBe('Andi Pratama');
    expect(body.timeline).toHaveLength(1);
  });

  it('tidak case-sensitive terhadap nomor resi', async () => {
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    const res = await GET({} as never, resiReq('dtms-2026-000001'));
    expect(res.status).toBe(200);
    expect(mockShipment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trackingNumber: 'DTMS-2026-000001' } })
    );
  });

  it('mengembalikan 404 jika resi tidak ditemukan', async () => {
    mockShipment.findUnique.mockResolvedValue(null);
    const res = await GET({} as never, resiReq('DTMS-000-XXX'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('tidak ditemukan');
  });

  it('estimasi ETA SAME_DAY = createdAt + 12 jam', async () => {
    mockShipment.findUnique.mockResolvedValue(SHIPMENT);
    const res = await GET({} as never, resiReq(RESI));
    const body = await res.json();
    expect(new Date(body.eta).toISOString()).toBe('2026-08-14T20:00:00.000Z');
  });
});
