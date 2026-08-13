import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const { error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR', 'MANAGEMENT', 'CUSTOMER_SERVICE');
  if (error) return error;

  const minutes = Number(req.nextUrl.searchParams.get('minutes')) || 60;
  const since = new Date(Date.now() - minutes * 60000);

  // lat & lng aktif semua shipment (untuk marker tujuan/asal)
  const shipments = await prisma.shipment.findMany({
    where: { status: { notIn: ['DELIVERED', 'RETURNED'] } },
    include: {
      assignments: { include: { driver: true, vehicle: true }, take: 1 },
      events: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const gpsLogs = await prisma.gpsLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    include: { driver: true, vehicle: true },
  });

  // posisi terakhir per driver
  const latestByDriver = new Map<string, (typeof gpsLogs)[number]>();
  for (const g of gpsLogs) {
    if (!latestByDriver.has(g.driverId)) latestByDriver.set(g.driverId, g);
  }

  return NextResponse.json({
    drivers: Array.from(latestByDriver.values()).map((g) => ({
      driverId: g.driverId,
      name: g.driver.name,
      vehicleNumber: g.vehicle?.vehicleNumber || null,
      latitude: g.latitude,
      longitude: g.longitude,
      speed: g.speed,
      heading: g.heading,
      accuracy: g.accuracy,
      battery: g.battery,
      updatedAt: g.createdAt,
    })),
    shipments: shipments.map((s) => ({
      id: s.id,
      trackingNumber: s.trackingNumber,
      status: s.status,
      destination: s.destination,
      origin: s.origin,
      driver: s.assignments[0]?.driver.name || null,
      vehicle: s.assignments[0]?.vehicle?.vehicleNumber || null,
      originLat: s.originLat ?? s.events[0]?.latitude ?? null,
      originLng: s.originLng ?? s.events[0]?.longitude ?? null,
      destLat: s.destLat ?? s.events[0]?.latitude ?? null,
      destLng: s.destLng ?? s.events[0]?.longitude ?? null,
    })),
  });
}