import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

const VALID_ACTIONS = ['START', 'ARRIVE', 'POD', 'FAIL'] as const;

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.SHIPMENT.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findFirst({
      where: { userId: session?.id },
      select: { id: true, name: true },
    });

    if (!driver) {
      return NextResponse.json({ assignments: [], driverName: session?.name || 'Driver' });
    }

    const assignments = await prisma.deliveryAssignment.findMany({
      where: { driverId: driver.id },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            origin: true,
            destination: true,
            weight: true,
            sender: { select: { name: true, phone: true, address: true } },
            receiver: { select: { name: true, phone: true, address: true, city: true } },
            events: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, createdAt: true },
            },
            pods: {
              orderBy: { deliveredAt: 'desc' },
              take: 1,
              select: { receiverName: true, deliveredAt: true, signature: true, photo: true, notes: true },
            },
          },
        },
        vehicle: { select: { vehicleNumber: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ assignments, driverName: driver.name });
  });
}

export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.DELIVERY.START);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { shipmentId, action, reason, recipientName, notes } = body;

    const trimmedShipmentId = shipmentId ? String(shipmentId).trim() : '';
    if (!trimmedShipmentId) {
      return NextResponse.json({ error: 'shipmentId wajib diisi' }, { status: 400 });
    }

    const trimmedAction = action ? String(action).trim().toUpperCase() : '';
    if (!trimmedAction || !(VALID_ACTIONS as readonly string[]).includes(trimmedAction)) {
      return NextResponse.json({ error: `action wajib diisi dan harus salah satu dari: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const trimmedReason = reason ? String(reason).trim().slice(0, 500) : null;
    const trimmedRecipientName = recipientName ? String(recipientName).trim().slice(0, 100) : null;
    const trimmedNotes = notes ? String(notes).trim().slice(0, 500) : null;

    const shipment = await prisma.shipment.findUnique({ where: { id: trimmedShipmentId } });
    if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

    const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { shipmentId: trimmedShipmentId, driverId: driver.id },
    });
    if (!assignment) return NextResponse.json({ error: 'Tidak ada penugasan untuk shipment ini' }, { status: 403 });

    let newStatus = shipment.status;
    const metadata: Record<string, unknown> = {};

    switch (trimmedAction) {
      case 'START':
        newStatus = 'IN_TRANSIT';
        break;
      case 'ARRIVE':
        newStatus = 'OUT_FOR_DELIVERY';
        break;
      case 'POD':
        newStatus = 'DELIVERED';
        metadata.recipientName = trimmedRecipientName;
        metadata.notes = trimmedNotes;
        await prisma.proofOfDelivery.create({
          data: {
            shipmentId: trimmedShipmentId,
            receiverName: trimmedRecipientName || 'Unknown',
            notes: trimmedNotes,
          },
        });
        break;
      case 'FAIL':
        newStatus = 'DELIVERY_FAILED';
        metadata.reason = trimmedReason;
        break;
      default:
        return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
    }

    await prisma.shipment.update({ where: { id: trimmedShipmentId }, data: { status: newStatus as never } });

    await prisma.shipmentEvent.create({
      data: {
        shipmentId: trimmedShipmentId,
        eventType: trimmedAction === 'POD' ? 'DELIVERED' : trimmedAction === 'FAIL' ? 'DELIVERY_FAILED' : 'STATUS_UPDATED',
        previousStatus: shipment.status,
        newStatus: newStatus as never,
        actorType: 'DRIVER',
        actorId: driver.id,
        metadata: JSON.stringify(metadata),
      },
    });

    return NextResponse.json({ success: true, status: newStatus });
  });
}
