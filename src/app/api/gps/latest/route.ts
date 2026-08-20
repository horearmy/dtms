import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.GPS.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const minutes = Number(req.nextUrl.searchParams.get('minutes')) || 60;
    const since = new Date(Date.now() - minutes * 60000);
    const tenantFilter = session?.tenantId;
    const limitParam = Number(req.nextUrl.searchParams.get('limit')) || 1000;
    const limit = Math.min(limitParam, 5000);

    let gpsRows: any[];
    if (tenantFilter) {
      gpsRows = await prisma.$queryRaw`
        SELECT DISTINCT ON (g."driverId")
          g."driverId", g."vehicleId", g.latitude, g.longitude, g.speed, g.heading,
          g.accuracy, g.battery, g."createdAt",
          d.name, d.photo, d.returning, d."returnedAt",
          v."vehicleNumber"
        FROM "GpsLog" g
        JOIN "Driver" d ON d.id = g."driverId"
        LEFT JOIN "Vehicle" v ON v.id = g."vehicleId"
        WHERE g."createdAt" >= ${since}
          AND d."tenantId" = ${tenantFilter}
        ORDER BY g."driverId", g."createdAt" DESC
        LIMIT ${limit}
      `;
    } else {
      gpsRows = await prisma.$queryRaw`
        SELECT DISTINCT ON (g."driverId")
          g."driverId", g."vehicleId", g.latitude, g.longitude, g.speed, g.heading,
          g.accuracy, g.battery, g."createdAt",
          d.name, d.photo, d.returning, d."returnedAt",
          v."vehicleNumber"
        FROM "GpsLog" g
        JOIN "Driver" d ON d.id = g."driverId"
        LEFT JOIN "Vehicle" v ON v.id = g."vehicleId"
        WHERE g."createdAt" >= ${since}
        ORDER BY g."driverId", g."createdAt" DESC
        LIMIT ${limit}
      `;
    }

    const driverIds = gpsRows.map((r: any) => r.driverId);
    const warehouseRows = driverIds.length
      ? await prisma.$queryRaw<
          { driverId: string; origin: string | null; originLat: number | null; originLng: number | null; lastEventLat: number | null; lastEventLng: number | null }[]
        >`
          SELECT DISTINCT ON (da."driverId")
            da."driverId", s.origin, s."originLat", s."originLng",
            te.latitude AS "lastEventLat", te.longitude AS "lastEventLng"
          FROM "DeliveryAssignment" da
          JOIN "Shipment" s ON s.id = da."shipmentId"
          LEFT JOIN "ShipmentEvent" te ON te."shipmentId" = s.id AND te."createdAt" = (
            SELECT MAX(te2."createdAt") FROM "ShipmentEvent" te2 WHERE te2."shipmentId" = s.id
          )
          WHERE da."driverId" = ANY(${driverIds})
          ORDER BY da."driverId", da."assignedAt" ASC
        `
      : [];

    const warehouseMap = new Map(warehouseRows.map((w: any) => [w.driverId, w]));

    const shipments = await prisma.shipment.findMany({
      where: { status: { notIn: ['DELIVERED', 'RETURNED'] } },
      include: {
        assignments: { include: { driver: true, vehicle: true }, take: 1 },
        events: { orderBy: { createdAt: 'desc' }, take: 1 },
        stops: { orderBy: { seq: 'asc' } },
      },
      take: 500,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      drivers: gpsRows.map((g: any) => {
        const w = warehouseMap.get(g.driverId);
        return {
          driverId: g.driverId,
          name: g.name,
          photo: g.photo,
          vehicleNumber: g.vehicleNumber || null,
          latitude: g.latitude,
          longitude: g.longitude,
          speed: g.speed,
          heading: g.heading,
          accuracy: g.accuracy,
          battery: g.battery,
          returning: g.returning,
          returnedAt: g.returnedAt,
          warehouseName: w?.origin || null,
          warehouseLat: w?.originLat ?? w?.lastEventLat ?? null,
          warehouseLng: w?.originLng ?? w?.lastEventLng ?? null,
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
