import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { sendShipmentStatusUpdate } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.DELIVERY.COMPLETE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
    }
    const receiverName = String(body.receiverName || '');
    const signature = typeof body.signature === 'string' ? body.signature : null;
    const photo = typeof body.photo === 'string' ? body.photo : null;
    const notes = String(body.notes || '');
    const lat = typeof body.lat === 'number' ? body.lat : null;
    const lng = typeof body.lng === 'number' ? body.lng : null;

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

    if (session?.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'POD / penyelesaian pengiriman hanya dapat dilakukan oleh driver yang ditugaskan' },
        { status: 403 }
      );
    }

    const driver = await prisma.driver.findUnique({ where: { userId: session.id } });
    if (!driver) {
      return NextResponse.json({ error: 'Profil driver tidak ditemukan' }, { status: 403 });
    }
    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { shipmentId: id, driverId: driver.id },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Shipment ini bukan tugas Anda' }, { status: 403 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.proofOfDelivery.create({
          data: {
            shipmentId: id,
            receiverName: receiverName || shipment.receiver.name,
            signature: signature || null,
            photo: photo || null,
            latitude: lat ?? null,
            longitude: lng ?? null,
            notes: notes || null,
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
    } catch (txErr) {
      logger.error('[POD] Transaction error', { context: 'api', data: { shipmentId: id, error: txErr instanceof Error ? txErr.message : 'Unknown error' } });
      return NextResponse.json({ error: 'Gagal menyimpan POD' }, { status: 500 });
    }

    try {
      await sendShipmentStatusUpdate(
        shipment.trackingNumber,
        'DELIVERED',
        shipment.receiver.phone,
        receiverName || shipment.receiver.name,
        shipment.destination,
        null
      );
    } catch {
      // WhatsApp failure is non-critical
    }

    await logAudit(session, 'POD_COMPLETE', 'SHIPMENT', { newData: { trackingNumber: shipment.trackingNumber, receiver: receiverName || shipment.receiver.name } }, req);
    return NextResponse.json({ ok: true });
  });
}