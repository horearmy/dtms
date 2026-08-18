import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard();
  if (error) return error;

  const { id } = await params;

  const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
  if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

  const assignment = await prisma.deliveryAssignment.findFirst({
    where: { shipmentId: id, driverId: driver.id },
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          destination: true,
          destLat: true,
          destLng: true,
          origin: true,
          originLat: true,
          originLng: true,
          status: true,
          sender: { select: { name: true, phone: true, address: true } },
          receiver: { select: { name: true, phone: true, address: true } },
        },
      },
      vehicle: { select: { vehicleNumber: true } },
    },
  });

  if (!assignment || !assignment.shipment) {
    return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
  }

  const items = await prisma.shipmentItem.findMany({
    where: { shipmentId: id },
    select: { itemName: true, quantity: true, weight: true },
  });

  return NextResponse.json({
    id: assignment.shipment.id,
    trackingNumber: assignment.shipment.trackingNumber,
    destination: assignment.shipment.destination,
    destAddress: assignment.shipment.receiver?.address || assignment.shipment.destination,
    destLat: assignment.shipment.destLat,
    destLng: assignment.shipment.destLng,
    receiverName: assignment.shipment.receiver?.name || null,
    receiverPhone: assignment.shipment.receiver?.phone || null,
    status: assignment.shipment.status,
    assignedAt: assignment.assignedAt.toISOString(),
    vehicleNumber: assignment.vehicle?.vehicleNumber || null,
    items,
    originAddress: assignment.shipment.sender?.address || assignment.shipment.origin,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Delegate to the tasks route POST logic
  const { id } = await params;
  const body = await req.json();

  const driver = await prisma.driver.findFirst({
    where: { userId: (await guard()).session?.id },
  });
  if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

  let newStatus = shipment.status;
  const metadata: Record<string, unknown> = {};

  switch (body.action) {
    case 'START':
      newStatus = 'IN_TRANSIT';
      break;
    case 'ARRIVE':
      newStatus = 'OUT_FOR_DELIVERY';
      break;
    case 'POD':
      newStatus = 'DELIVERED';
      metadata.recipientName = body.recipientName;
      metadata.notes = body.notes;
      await prisma.proofOfDelivery.create({
        data: {
          shipmentId: id,
          receiverName: body.recipientName || 'Unknown',
          notes: body.notes || null,
        },
      });
      break;
    case 'FAIL':
      newStatus = 'DELIVERY_FAILED';
      metadata.reason = body.reason;
      break;
    default:
      return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  }

  await prisma.shipment.update({ where: { id }, data: { status: newStatus as never } });

  await prisma.shipmentEvent.create({
    data: {
      tenantId: shipment.tenantId,
      shipmentId: id,
      eventType: body.action === 'POD' ? 'DELIVERED' : body.action === 'FAIL' ? 'DELIVERY_FAILED' : 'STATUS_UPDATED',
      previousStatus: shipment.status,
      newStatus: newStatus as never,
      actorType: 'DRIVER',
      actorId: driver.id,
      metadata: JSON.stringify(metadata),
    },
  });

  return NextResponse.json({ success: true, status: newStatus });
}
