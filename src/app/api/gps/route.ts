import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { checkGeofences } from '@/lib/geofence';
import { recordUsage } from '@/lib/billing';
import { haversineKm } from '@/lib/eta';
import { MAINTENANCE_DISTANCE_KM } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.GPS.SEND);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { latitude, longitude, speed, heading, accuracy, battery } = body || {};
    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'Koordinat wajib diisi' }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
    if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { driverId: driver.id },
      orderBy: { assignedAt: 'desc' },
    });

    const lat = Number(latitude);
    const lng = Number(longitude);

    const log = await prisma.gpsLog.create({
      data: {
        driverId: driver.id,
        vehicleId: assignment?.vehicleId || null,
        latitude: lat,
        longitude: lng,
        speed: speed != null ? Number(speed) : null,
        heading: heading != null ? Number(heading) : null,
        accuracy: accuracy != null ? Number(accuracy) : null,
        battery: battery != null ? Number(battery) : null,
      },
    });

    // Record GPS usage for metered billing (fire-and-forget)
    if (session?.tenantId) {
      recordUsage(session.tenantId, 'gps_points', 1).catch(() => {});
    }

    const geofenceEvents = await checkGeofences(driver.id, lat, lng, assignment?.shipmentId);

    // akumulasi jarak tempuh kendaraan dari jarak antar titik GPS
    if (log.vehicleId) {
      const prev = await prisma.gpsLog.findFirst({
        where: { vehicleId: log.vehicleId, id: { not: log.id } },
        orderBy: { createdAt: 'desc' },
      });
      if (prev) {
        const km = haversineKm(prev.latitude, prev.longitude, lat, lng);
        if (km > 0) {
          await prisma.vehicle.update({
            where: { id: log.vehicleId },
            data: { totalDistanceKm: { increment: km } },
          });
        }
      }
      const vehicle = await prisma.vehicle.findUnique({ where: { id: log.vehicleId } });
      if (vehicle && vehicle.totalDistanceKm >= MAINTENANCE_DISTANCE_KM && vehicle.status !== 'MAINTENANCE') {
        await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'MAINTENANCE' } });
        await prisma.notification.create({
          data: {
            message: `Kendaraan ${vehicle.vehicleNumber} mencapai ${Math.round(vehicle.totalDistanceKm)} km dan wajib perawatan (status otomatis MAINTENANCE).`,
          },
        });
        await logAudit(session, 'VEHICLE_MAINTENANCE', 'VEHICLE', { newData: { vehicleNumber: vehicle.vehicleNumber, status: 'MAINTENANCE', totalDistanceKm: Math.round(vehicle.totalDistanceKm) } }, req);
      }
    }

    return NextResponse.json({ ok: true, id: log.id, geofenceEvents });
  });
}