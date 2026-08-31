import { NextRequest, NextResponse } from 'next/server';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { broadcast } from '@/lib/sse-bus';
import { ON_ROAD_STATUSES } from '@/lib/constants';
import { sendTextMessage, isWhatsAppEnabled } from '@/lib/whatsapp';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.DISPATCH.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};
    const [unassignedShipments, availableDrivers, availableVehicles, activeAssignments] = await Promise.all([
      prisma.shipment.findMany({
        where: {
          ...tenantFilter,
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

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

    const VALID_DISPATCH_STATUSES = ['WAREHOUSE_RECEIVED', 'SORTING', 'ORDER_CREATED'];
    if (!VALID_DISPATCH_STATUSES.includes(shipment.status)) {
      return NextResponse.json({ error: `Shipment dengan status ${shipment.status} tidak dapat ditugaskan` }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });
    if (driver.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Driver ${driver.name} tidak berstatus AKTIF` }, { status: 400 });
    }
    if (driver.returning) {
      return NextResponse.json({ error: `Driver ${driver.name} sedang kembali ke gudang. Pilih driver lain.` }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 });
    if (vehicle.status === 'MAINTENANCE') {
      return NextResponse.json({ error: `Kendaraan ${vehicle.vehicleNumber} sedang MAINTENANCE` }, { status: 400 });
    }
    if (vehicle.returning) {
      return NextResponse.json({ error: `Kendaraan ${vehicle.vehicleNumber} sedang kembali ke gudang` }, { status: 400 });
    }

    const [driverActiveTrip, vehicleActiveTrip, existing] = await Promise.all([
      prisma.deliveryAssignment.findFirst({
        where: { driverId, shipmentId: { not: shipmentId }, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
        select: { shipment: { select: { trackingNumber: true } } },
      }),
      prisma.deliveryAssignment.findFirst({
        where: { vehicleId, shipmentId: { not: shipmentId }, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
        select: { shipment: { select: { trackingNumber: true } } },
      }),
      prisma.deliveryAssignment.findFirst({ where: { shipmentId, driverId } }),
    ]);
    if (driverActiveTrip) {
      return NextResponse.json(
        { error: `Driver ${driver.name} masih dalam perjalanan (resi ${driverActiveTrip.shipment.trackingNumber}) dan belum kembali. Pilih driver lain.` },
        { status: 400 }
      );
    }
    if (vehicleActiveTrip) {
      return NextResponse.json(
        { error: `Kendaraan ${vehicle.vehicleNumber} sedang digunakan untuk resi ${vehicleActiveTrip.shipment.trackingNumber} (belum kembali). Pilih kendaraan lain.` },
        { status: 400 }
      );
    }
    if (existing) return NextResponse.json({ error: 'Shipment sudah ditugaskan ke driver ini' }, { status: 409 });

    const assignment = await prisma.$transaction((tx) =>
      tx.deliveryAssignment.create({
        data: { shipmentId, driverId, vehicleId },
        include: {
          shipment: { select: { trackingNumber: true } },
          driver: { select: { name: true, phone: true } },
          vehicle: { select: { vehicleNumber: true } },
        },
      })
    );

    if (isWhatsAppEnabled() && driver.phone) {
      try {
        await sendTextMessage(
          driver.phone,
          `Anda ditugaskan untuk pengiriman resi *${shipment.trackingNumber}*\n` +
          `Tujuan: ${shipment.destination}\n\n` +
          `Silakan lakukan verifikasi keberangkatan (scan gudang) untuk memulai perjalanan.`
        );
      } catch {
        // WhatsApp failure is non-critical
      }
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
