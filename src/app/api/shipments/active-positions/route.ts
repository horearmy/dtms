import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import type { ShipmentStatus } from '@prisma/client';

const ACTIVE: ShipmentStatus[] = [
  'ORDER_CREATED', 'WAREHOUSE_RECEIVED', 'DISPATCHED',
  'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'RESCHEDULED',
];

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const assignments = await prisma.deliveryAssignment.findMany({
      where: {
        shipment: {
          status: { in: ACTIVE },
          ...(session?.tenantId ? { tenantId: session.tenantId } : {}),
        },
      },
      include: {
        shipment: { select: { id: true, trackingNumber: true, status: true, origin: true, destination: true, tenantId: true } },
        driver: {
          select: {
            id: true, name: true, employeeId: true, status: true,
            gpsLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { latitude: true, longitude: true, speed: true, battery: true, createdAt: true } },
          },
        },
        vehicle: { select: { id: true, vehicleNumber: true } },
      },
    });

    type AssignmentRow = (typeof assignments)[number];
    const positions = (assignments as AssignmentRow[])
      .filter((a) => a.driver?.gpsLogs?.[0])
      .map((a) => {
        const gps = a.driver.gpsLogs[0];
        return {
          shipmentId: a.shipment.id,
          trackingNumber: a.shipment.trackingNumber,
          status: a.shipment.status,
          origin: a.shipment.origin,
          destination: a.shipment.destination,
          tenantId: a.shipment.tenantId,
          driver: { id: a.driver.id, name: a.driver.name, employeeId: a.driver.employeeId },
          vehicle: a.vehicle ? { id: a.vehicle.id, vehicleNumber: a.vehicle.vehicleNumber } : null,
          gps: { latitude: gps.latitude, longitude: gps.longitude, speed: gps.speed, battery: gps.battery, createdAt: gps.createdAt },
        };
      });

    return NextResponse.json({ items: positions, total: positions.length });
  });
}
