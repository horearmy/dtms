import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Status yang dianggap masih berjalan (belum final)
const ACTIVE_SHIPMENT_STATUSES = [
  'ORDER_CREATED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'WAREHOUSE_RECEIVED',
  'SORTING',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED_AT_HUB',
  'OUT_FOR_DELIVERY',
  'RESCHEDULED',
];

// GET — pengiriman aktif lintas tenant + posisi GPS live driver (superadmin only)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const limit = Math.min(60, Math.max(4, parseInt(req.nextUrl.searchParams.get('limit') || '24', 10)));
  const q = req.nextUrl.searchParams.get('q') || '';

  const where: Record<string, unknown> = { status: { in: ACTIVE_SHIPMENT_STATUSES } };
  if (q) {
    where.OR = [
      { trackingNumber: { contains: q } },
      { destination: { contains: q } },
      { tenant: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
      { assignments: { some: { driver: { is: { name: { contains: q, mode: 'insensitive' as const } } } } } },
    ];
  }

  const shipments = await prisma.shipment.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit * 3,
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      origin: true,
      destination: true,
      serviceType: true,
      slaDeadline: true,
      createdAt: true,
      updatedAt: true,
      tenant: { select: { id: true, name: true } },
      receiver: { select: { name: true } },
      assignments: {
        orderBy: { assignedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              gpsLogs: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { latitude: true, longitude: true, speed: true, createdAt: true },
              },
            },
          },
          vehicle: { select: { vehicleNumber: true } },
        },
      },
    },
  });

  const cards = shipments.map((s) => {
    const assignment = s.assignments[0] ?? null;
    const gps = assignment?.driver?.gpsLogs?.[0] ?? null;
    return {
      id: s.id,
      trackingNumber: s.trackingNumber,
      status: s.status,
      origin: s.origin,
      destination: s.destination,
      serviceType: s.serviceType,
      slaDeadline: s.slaDeadline,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      tenant: s.tenant,
      receiverName: s.receiver?.name ?? null,
      driver: assignment
        ? { id: assignment.driver.id, name: assignment.driver.name, phone: assignment.driver.phone }
        : null,
      vehicleNumber: assignment?.vehicle?.vehicleNumber ?? null,
      gps: gps
        ? { lat: gps.latitude, lng: gps.longitude, speed: gps.speed, updatedAt: gps.createdAt }
        : null,
    };
  });

  // Prioritaskan kartu dengan GPS live (paling baru), sisanya mengikuti
  const withGps = cards.filter((c) => c.gps).sort(
    (a, b) => new Date(b.gps!.updatedAt).getTime() - new Date(a.gps!.updatedAt).getTime()
  );
  const withoutGps = cards.filter((c) => !c.gps);
  const ordered = [...withGps, ...withoutGps].slice(0, limit);

  // Ringkasan per status untuk header section
  const statusCounts = ordered.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ shipments: ordered, statusCounts, total: ordered.length });
}
