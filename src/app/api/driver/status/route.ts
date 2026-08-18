import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { ShipmentStatus } from '@prisma/client';

const ACTIVE_STATUS: ShipmentStatus[] = ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY'];

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.DELIVERY.START);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
    if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

    // kendaraan yang sedang dipakai (penugasan terbaru)
    const latestAssignment = await prisma.deliveryAssignment.findFirst({
      where: { driverId: driver.id },
      orderBy: { assignedAt: 'desc' },
      include: { vehicle: true },
    });

    // shipment yang sedang aktif (status perjalanan)
    const activeAssignment = await prisma.deliveryAssignment.findFirst({
      where: { driverId: driver.id, shipment: { status: { in: ACTIVE_STATUS } } },
      orderBy: { assignedAt: 'desc' },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            origin: true,
            destination: true,
            originLat: true,
            originLng: true,
            destLat: true,
            destLng: true,
            receiver: { select: { name: true, address: true, city: true } },
          },
        },
      },
    });

    // posisi GPS terakhir driver
    const gps = await prisma.gpsLog.findFirst({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      driver: {
        id: driver.id,
        name: driver.name,
        employeeId: driver.employeeId,
        status: driver.status,
        returning: driver.returning,
        returnedAt: driver.returnedAt,
        returnStartedAt: driver.returnStartedAt,
        vehicle: latestAssignment?.vehicle
          ? {
              id: latestAssignment.vehicle.id,
              vehicleNumber: latestAssignment.vehicle.vehicleNumber,
              type: latestAssignment.vehicle.type,
              status: latestAssignment.vehicle.status,
              returning: latestAssignment.vehicle.returning,
            }
          : null,
        gps: gps
          ? {
              latitude: gps.latitude,
              longitude: gps.longitude,
              speed: gps.speed,
              battery: gps.battery,
              createdAt: gps.createdAt,
            }
          : null,
        active: activeAssignment?.shipment
          ? {
              id: activeAssignment.shipment.id,
              trackingNumber: activeAssignment.shipment.trackingNumber,
              status: activeAssignment.shipment.status,
              origin: activeAssignment.shipment.origin,
              destination: activeAssignment.shipment.destination,
              originLat: activeAssignment.shipment.originLat,
              originLng: activeAssignment.shipment.originLng,
              destLat: activeAssignment.shipment.destLat,
              destLng: activeAssignment.shipment.destLng,
              receiverName: activeAssignment.shipment.receiver.name,
              receiverAddress: activeAssignment.shipment.receiver.address,
              receiverCity: activeAssignment.shipment.receiver.city,
            }
          : null,
      },
    });
  });
}
