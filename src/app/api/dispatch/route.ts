import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { broadcast } from '@/lib/sse-bus';
import { createAssignment } from '@/lib/assignment-service';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.DISPATCH.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};
    const branchFilter = session?.branchId ? { branchId: session.branchId } : {};
    const [unassignedShipments, availableDrivers, availableVehicles, activeAssignments] = await Promise.all([
      prisma.shipment.findMany({
        where: {
          ...tenantFilter,
          ...branchFilter,
          status: { in: ['WAREHOUSE_RECEIVED', 'SORTING', 'ORDER_CREATED'] },
          assignments: { none: {} },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.driver.findMany({
        where: {
          ...tenantFilter,
          status: 'ACTIVE',
          assignments: { none: { shipment: { status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } } },
        },
        take: 50,
      }),
      prisma.vehicle.findMany({
        where: {
          ...tenantFilter,
          status: 'AVAILABLE',
        },
        take: 50,
      }),
      prisma.deliveryAssignment.findMany({
        where: {
          shipment: {
            ...tenantFilter,
            ...branchFilter,
            status: { in: ['WAREHOUSE_RECEIVED', 'SORTING', 'ORDER_CREATED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
          },
        },
        include: {
          shipment: { select: { id: true, trackingNumber: true, destination: true, status: true } },
          driver: { select: { id: true, name: true, employeeId: true } },
          vehicle: { select: { id: true, vehicleNumber: true, type: true, capacity: true } },
        },
        orderBy: { assignedAt: 'desc' },
        take: 50,
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

    if (!shipmentId || !driverId || !vehicleId) {
      return NextResponse.json({ error: 'shipmentId, driverId, dan vehicleId wajib diisi' }, { status: 400 });
    }

    const result = await createAssignment({
      shipmentId: String(shipmentId),
      driverId: String(driverId),
      vehicleId: String(vehicleId),
      requireActiveDriver: true,
      requireShipmentAssignable: true,
      reassign: false,
      branchId: session?.branchId ?? null,
      waProceed: 'Silakan lakukan verifikasi keberangkatan (scan gudang) untuk memulai perjalanan.',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const channel = session?.tenantId ? `tenant:${session.tenantId}` : 'global';
    broadcast(channel, 'dispatch:created', {
      assignmentId: result.assignment.id,
      trackingNumber: result.assignment.shipment.trackingNumber,
      driverName: result.assignment.driver.name,
      vehicleNumber: result.assignment.vehicle?.vehicleNumber,
      createdAt: new Date().toISOString(),
    });
    broadcast(channel, 'control-tower:update', { type: 'dispatch' });

    await logAudit(session, 'DISPATCH_ASSIGN', 'DISPATCH', { newData: { shipmentId: result.assignment.shipmentId, driverId: result.assignment.driverId } }, req);

    return NextResponse.json(result.assignment, { status: 201 });
  });
}
