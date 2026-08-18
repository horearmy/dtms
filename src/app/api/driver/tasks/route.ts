import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

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
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

  const body = await req.json();
  const { shipmentId, action, reason, recipientName, notes } = body;

  if (!shipmentId || !action) {
    return NextResponse.json({ error: 'shipmentId dan action wajib' }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

  const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
  if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { shipmentId, driverId: driver.id },
  });
  if (!assignment) return NextResponse.json({ error: 'Tidak ada penugasan untuk shipment ini' }, { status: 403 });

  let newStatus = shipment.status;
  const metadata: Record<string, unknown> = {};

  switch (action) {
    case 'START':
      newStatus = 'IN_TRANSIT';
      break;
    case 'ARRIVE':
      newStatus = 'OUT_FOR_DELIVERY';
      break;
    case 'POD':
      newStatus = 'DELIVERED';
      metadata.recipientName = recipientName;
      metadata.notes = notes;
      await prisma.proofOfDelivery.create({
        data: {
          shipmentId,
          receiverName: recipientName || 'Unknown',
          notes: notes || null,
        },
      });
      break;
    case 'FAIL':
      newStatus = 'DELIVERY_FAILED';
      metadata.reason = reason;
      break;
    default:
      return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  }

  await prisma.shipment.update({ where: { id: shipmentId }, data: { status: newStatus as never } });

  await prisma.shipmentEvent.create({
    data: {
      tenantId: shipment.tenantId,
      shipmentId,
      eventType: action === 'POD' ? 'DELIVERED' : action === 'FAIL' ? 'DELIVERY_FAILED' : 'STATUS_UPDATED',
      previousStatus: shipment.status,
      newStatus: newStatus as never,
      actorType: 'DRIVER',
      actorId: driver.id,
      metadata: JSON.stringify(metadata),
    },
  });

  return NextResponse.json({ success: true, status: newStatus });
}
