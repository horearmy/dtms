import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { STATUS_LABELS } from '@/lib/constants';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR', 'DRIVER'];

const DRIVER_FLOW: Record<string, string> = {
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED_AT_HUB',
  ARRIVED_AT_HUB: 'OUT_FOR_DELIVERY',
};

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

  if (session?.role === 'DRIVER') {
    const driver = await prisma.driver.findUnique({ where: { userId: session.id } });
    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { shipmentId: id, driverId: driver?.id },
    });
    if (!assignment) {
      return NextResponse.json({ error: 'Shipment ini bukan tugas Anda' }, { status: 403 });
    }
    const expected = DRIVER_FLOW[shipment.status];
    if (!expected || status !== expected) {
      return NextResponse.json(
        {
          error: expected
            ? `Driver hanya dapat melanjutkan ke langkah berikutnya (${STATUS_LABELS[expected]}), saat ini ${STATUS_LABELS[shipment.status] || shipment.status}`
            : 'Driver tidak dapat mengubah status saat ini',
        },
        { status: 400 }
      );
    }
  }

  if (status === 'DISPATCHED') {
    const assignment = await prisma.deliveryAssignment.findFirst({ where: { shipmentId: id } });
    if (!assignment?.driverId || !assignment?.vehicleId) {
      return NextResponse.json(
        { error: 'Lengkapi penugasan terlebih dahulu: pilih driver dan kendaraan sebelum keberangkatan' },
        { status: 400 }
      );
    }
    const vehicle = await prisma.vehicle.findUnique({ where: { id: assignment.vehicleId } });
    if (!vehicle || vehicle.status === 'MAINTENANCE') {
      return NextResponse.json(
        { error: 'Kendaraan tidak tersedia (status MAINTENANCE). Ganti kendaraan terlebih dahulu.' },
        { status: 400 }
      );
    }
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