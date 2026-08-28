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
    const numeric = { lat, lng, speed: speed == null ? null : Number(speed), heading: heading == null ? null : Number(heading), accuracy: accuracy == null ? null : Number(accuracy), battery: battery == null ? null : Number(battery) };
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Koordinat GPS tidak valid' }, { status: 400 });
    }
    if ([numeric.speed, numeric.heading, numeric.accuracy, numeric.battery].some((value) => value !== null && !Number.isFinite(value))) {
      return NextResponse.json({ error: 'Data telemetri GPS tidak valid' }, { status: 400 });
    }
    if (numeric.speed !== null && numeric.speed < 0) return NextResponse.json({ error: 'Speed tidak boleh negatif' }, { status: 400 });
    if (numeric.heading !== null && (numeric.heading < 0 || numeric.heading > 360)) return NextResponse.json({ error: 'Heading harus antara 0 dan 360' }, { status: 400 });
    if (numeric.accuracy !== null && numeric.accuracy < 0) return NextResponse.json({ error: 'Accuracy tidak boleh negatif' }, { status: 400 });
    if (numeric.battery !== null && (numeric.battery < 0 || numeric.battery > 100)) return NextResponse.json({ error: 'Battery harus antara 0 dan 100' }, { status: 400 });
    const ingestKey = req.headers.get('idempotency-key')?.trim() || null;
    if (ingestKey && (ingestKey.length < 8 || ingestKey.length > 200)) return NextResponse.json({ error: 'Idempotency-Key harus berukuran 8-200 karakter' }, { status: 400 });
    if (ingestKey) {
      const existing = await prisma.gpsLog.findUnique({ where: { ingestKey }, select: { id: true } });
      if (existing) return NextResponse.json({ ok: true, id: existing.id, duplicate: true, geofenceEvents: [] });
    }

    const log = await prisma.gpsLog.create({
      data: {
        driverId: driver.id,
        ingestKey,
        vehicleId: assignment?.vehicleId || null,
        latitude: lat,
        longitude: lng,
        speed: numeric.speed,
        heading: numeric.heading,
        accuracy: numeric.accuracy,
        battery: numeric.battery,
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
