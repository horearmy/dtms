import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'DRIVER', 'CUSTOMER_SERVICE');
  if (error) return error;

  const body = await req.json();
  const { receiverName, signature, photo, notes, lat, lng } = body || {};

  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { receiver: true } });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

  if (shipment.status === 'DELIVERED') {
    return NextResponse.json({ error: 'Shipment sudah terkirim' }, { status: 400 });
  }

  if (shipment.status !== 'OUT_FOR_DELIVERY') {
    return NextResponse.json(
      { error: `POD hanya dapat diselesaikan saat status Sedang Diantar (saat ini: ${shipment.status})` },
      { status: 400 }
    );
  }

  // Validasi jika role DRIVER: harus merupakan driver yang ditugaskan
  if (session?.role === 'DRIVER') {
    const driver = await prisma.driver.findUnique({ where: { userId: session.id } });
    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { shipmentId: id, driverId: driver?.id },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Shipment ini bukan tugas Anda' }, { status: 403 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.proofOfDelivery.upsert({
      where: { shipmentId: id },
      create: {
        shipmentId: id,
        receiverName: receiverName || shipment.receiver.name,
        signature: signature || null,
        photo: photo || null,
        latitude: lat ?? null,
        longitude: lng ?? null,
        notes: notes || null,
      },
      update: {
        receiverName: receiverName || shipment.receiver.name,
        signature: signature || undefined,
        photo: photo || undefined,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        notes: notes || undefined,
      },
    });
    await tx.shipment.update({ where: { id }, data: { status: 'DELIVERED' } });
    await tx.trackingEvent.create({
      data: {
        shipmentId: id,
        status: 'DELIVERED',
        latitude: lat ?? null,
        longitude: lng ?? null,
        notes: 'POD diterima: ' + (receiverName || shipment.receiver.name),
        createdBy: session?.id,
      },
    });
    await tx.notification.create({
      data: { shipmentId: id, message: `${shipment.trackingNumber} telah diterima oleh ${receiverName || shipment.receiver.name}` },
    });
  });

  await logAudit(session, 'POD_COMPLETE', 'SHIPMENT', shipment.trackingNumber);
  return NextResponse.json({ ok: true });
}