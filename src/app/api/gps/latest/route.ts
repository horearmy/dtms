import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.GPS.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const minutes = Number(req.nextUrl.searchParams.get('minutes')) || 60;
    const since = new Date(Date.now() - minutes * 60000);

    // lat & lng aktif semua shipment (untuk marker tujuan/asal)
    const shipments = await prisma.shipment.findMany({
      where: { status: { notIn: ['DELIVERED', 'RETURNED'] } },
      include: {
        assignments: { include: { driver: true, vehicle: true }, take: 1 },
        events: { orderBy: { createdAt: 'desc' }, take: 1 },
        stops: { orderBy: { seq: 'asc' } },
      },
    });

    const gpsLogs = await prisma.gpsLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(session?.tenantId ? { driver: { tenantId: session.tenantId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { driver: true, vehicle: true },
    });

    // posisi terakhir per driver
    const latestByDriver = new Map<string, (typeof gpsLogs)[number]>();
    for (const g of gpsLogs) {
      if (!latestByDriver.has(g.driverId)) latestByDriver.set(g.driverId, g);
    }

    // gudang asal per driver (asal shipment pada penugasan terbarunya) utk rute kembali
    const driverIds = Array.from(latestByDriver.keys());
    const latestAssignments = driverIds.length
      ? await prisma.deliveryAssignment.findMany({
          where: { driverId: { in: driverIds } },
          orderBy: { assignedAt: 'asc' },
          distinct: ['driverId'],
          select: {
            driverId: true,
            shipment: {
              select: {
                originLat: true,
                originLng: true,
                origin: true,
                events: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
            },
          },
        })
      : [];
    const warehouseByDriver = new Map(
      latestAssignments.map((a) => [
        a.driverId,
        {
          name: a.shipment.origin,
          lat: a.shipment.originLat ?? a.shipment.events[0]?.latitude ?? null,
          lng: a.shipment.originLng ?? a.shipment.events[0]?.longitude ?? null,
        },
      ])
    );

    return NextResponse.json({
      drivers: Array.from(latestByDriver.values()).map((g) => {
        const w = warehouseByDriver.get(g.driverId);
        return {
          driverId: g.driverId,
          name: g.driver.name,
          photo: g.driver.photo,
          vehicleNumber: g.vehicle?.vehicleNumber || null,
          latitude: g.latitude,
          longitude: g.longitude,
          speed: g.speed,
          heading: g.heading,
          accuracy: g.accuracy,
          battery: g.battery,
          returning: g.driver.returning,
          returnedAt: g.driver.returnedAt,
          warehouseName: w?.name || null,
          warehouseLat: w?.lat ?? null,
          warehouseLng: w?.lng ?? null,
          updatedAt: g.createdAt,
        };
      }),
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
        stops: s.stops
          .filter((st) => st.latitude != null && st.longitude != null)
          .map((st) => ({ seq: st.seq, label: st.label, latitude: st.latitude, longitude: st.longitude })),
      })),
    });
  });
}