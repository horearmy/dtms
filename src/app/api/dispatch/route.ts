import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { broadcast } from '@/lib/sse-bus';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.DISPATCH.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const [unassignedShipments, availableDrivers, availableVehicles, activeAssignments] = await Promise.all([
      prisma.shipment.findMany({
        where: {
          status: { in: ['WAREHOUSE_RECEIVED', 'SORTING', 'ORDER_CREATED'] },
          assignments: { none: {} },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.driver.findMany({
        where: {
          status: 'ACTIVE',
          assignments: { none: { shipment: { status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } } },
        },
        take: 50,
      }),
      prisma.vehicle.findMany({
        where: { status: 'AVAILABLE' },
        take: 50,
      }),
      prisma.deliveryAssignment.findMany({
        where: {
          shipment: {
            status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
          },
        },
        include: {
          shipment: { select: { id: true, trackingNumber: true, destination: true, status: true } },
          driver: { select: { id: true, name: true, employeeId: true } },
          vehicle: { select: { id: true, vehicleNumber: true, type: true, capacity: true } },
        },
        orderBy: { assignedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({ unassignedShipments, availableDrivers, availableVehicles, activeAssignments });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DISPATCH.ASSIGN);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { shipmentId, driverId, vehicleId } = body;

    if (!shipmentId || !driverId) {
      return NextResponse.json({ error: 'shipmentId dan driverId wajib diisi' }, { status: 400 });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });

    const existing = await prisma.deliveryAssignment.findFirst({ where: { shipmentId, driverId } });
    if (existing) return NextResponse.json({ error: 'Shipment sudah ditugaskan ke driver ini' }, { status: 409 });

    const assignment = await prisma.deliveryAssignment.create({
      data: {
        shipmentId,
        driverId,
        vehicleId: vehicleId || null,
      },
      include: {
        shipment: { select: { trackingNumber: true } },
        driver: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    await prisma.shipment.update({ where: { id: shipmentId }, data: { status: 'DISPATCHED' } });

    if (vehicleId) {
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'IN_USE' } });
    }

    const channel = session?.tenantId ? `tenant:${session.tenantId}` : 'global';
    broadcast(channel, 'dispatch:created', {
      assignmentId: assignment.id,
      trackingNumber: assignment.shipment?.trackingNumber,
      driverName: assignment.driver?.name,
      vehicleNumber: assignment.vehicle?.vehicleNumber,
      createdAt: new Date().toISOString(),
    });
    broadcast(channel, 'control-tower:update', { type: 'dispatch' });

    await logAudit(session, 'DISPATCH_ASSIGN', 'DISPATCH', { newData: { shipmentId, driverId } }, req);

    return NextResponse.json(assignment, { status: 201 });
  });
}
