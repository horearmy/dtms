import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { checkGeofences } from '@/lib/geofence';

export async function POST(req: NextRequest) {
  const { session, error } = await guard('DRIVER', 'SUPER_ADMIN', 'DISPATCHER', 'ADMIN_OPERASIONAL');
  if (error) return error;

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

  const geofenceEvents = await checkGeofences(driver.id, lat, lng, assignment?.shipmentId);

  return NextResponse.json({ ok: true, id: log.id, geofenceEvents });
}