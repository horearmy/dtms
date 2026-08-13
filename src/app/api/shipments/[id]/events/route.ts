import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { STATUS_LABELS } from '@/lib/constants';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard(...MANAGE);
  if (error) return error;

  const body = await req.json();
  const { status, notes, lat, lng } = body || {};
  if (!status) return NextResponse.json({ error: 'Status wajib diisi' }, { status: 400 });

  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

  if (['DELIVERED', 'RETURNED'].includes(shipment.status)) {
    return NextResponse.json({ error: 'Shipment sudah selesai (terminal status)' }, { status: 400 });
  }

  const event = await prisma.trackingEvent.create({
    data: {
      shipmentId: shipment.id,
      status,
      latitude: lat ?? null,
      longitude: lng ?? null,
      notes: notes || null,
      createdBy: session?.id,
    },
  });

  const updated = await prisma.shipment.update({
    where: { id },
    data: { status },
  });

  await prisma.notification.create({
    data: {
      shipmentId: id,
      message: `${shipment.trackingNumber}: ${STATUS_LABELS[status] || status}`,
    },
  });

  await logAudit(session, 'UPDATE_STATUS', 'SHIPMENT', `${shipment.trackingNumber}: ${shipment.status} -> ${status}`);

  return NextResponse.json({ event, shipment: updated });
}