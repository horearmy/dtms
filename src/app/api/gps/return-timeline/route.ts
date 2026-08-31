import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.GPS.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driverId = req.nextUrl.searchParams.get('driverId');
    if (!driverId) return NextResponse.json({ error: 'driverId wajib diisi' }, { status: 400 });

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });

    // Verify driver belongs to current tenant
    if (session?.tenantId && driver.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });
    }

    const points: any[] = [];
    if (driver.returnStartedAt) {
      const startedAt = driver.returnStartedAt;
      const endAt = driver.returnedAt ?? new Date();
      const logs = await prisma.gpsLog.findMany({
        where: { driverId: driver.id, createdAt: { gte: startedAt, lte: endAt } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });
      for (const g of logs) {
        points.push({
          latitude: g.latitude,
          longitude: g.longitude,
          speed: g.speed,
          battery: g.battery,
          accuracy: g.accuracy,
          createdAt: g.createdAt,
        });
      }
    }

    // informasi gudang asal (asal shipment penugasan terbaru)
    const latest = await prisma.deliveryAssignment.findFirst({
      where: { driverId: driver.id },
      orderBy: { assignedAt: 'desc' },
      select: { shipment: {
          select: { origin: true, originLat: true, originLng: true, createdAt: true, durationMin: true, events: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    });

    const beforeReturn = driver.returnStartedAt
      ? await prisma.gpsLog.findFirst({
          where: { driverId: driver.id, createdAt: { lt: driver.returnStartedAt } },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    return NextResponse.json({
      driver: {
        id: driver.id,
        name: driver.name,
        returning: driver.returning,
        returnStartedAt: driver.returnStartedAt,
        returnedAt: driver.returnedAt,
      },
      warehouse: {
        name: latest?.shipment.origin || null,
        lat: latest?.shipment.originLat ?? latest?.shipment.events[0]?.latitude ?? null,
        lng: latest?.shipment.originLng ?? latest?.shipment.events[0]?.longitude ?? null,
      },
      return: latest
        ? { estimatedBackAt: new Date(new Date(latest.shipment.createdAt).getTime() + (latest.shipment.durationMin ?? 0) * 60000).toISOString() }
        : null,
      beforeReturn: beforeReturn
        ? { latitude: beforeReturn.latitude, longitude: beforeReturn.longitude, createdAt: beforeReturn.createdAt }
        : null,
      points,
    });
  });
}