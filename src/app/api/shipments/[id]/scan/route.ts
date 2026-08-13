import { NextRequest, NextResponse } from 'next/server';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { STATUS_LABELS } from '@/lib/constants';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'SUPERVISOR'];
const WAREHOUSE_FLOW: Record<string, string> = {
  ORDER_CREATED: 'WAREHOUSE_RECEIVED',
  PICKUP_SCHEDULED: 'WAREHOUSE_RECEIVED',
  PICKED_UP: 'WAREHOUSE_RECEIVED',
  WAREHOUSE_RECEIVED: 'DISPATCHED',
  SORTING: 'DISPATCHED',
};
const ALLOWED = ['WAREHOUSE_RECEIVED', 'DISPATCHED'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard(...MANAGE);
  if (error) return error;

  const body = await req.json();
  const action = String(body.action || '');
  const { latitude, longitude, notes } = body || {};

  if (!ALLOWED.includes(action)) {
    return NextResponse.json({ error: 'Langkah gudang tidak valid untuk shipment ini' }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

  if (['DELIVERED', 'RETURNED'].includes(shipment.status)) {
    return NextResponse.json({ error: 'Shipment sudah selesai (terminal status)' }, { status: 400 });
  }

  const expected = WAREHOUSE_FLOW[shipment.status];
  if (expected !== action && shipment.status !== action) {
    return NextResponse.json(
      { error: `Scan ${STATUS_LABELS[action] || action} tidak valid dari status ${STATUS_LABELS[shipment.status] || shipment.status}` },
      { status: 400 }
    );
  }

  if (action === 'DISPATCHED') {
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

  const scan = await prisma.warehouseScan.create({
    data: {
      shipmentId: shipment.id,
      action,
      scannedBy: session?.id,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      notes: notes || null,
    },
  });

  const updated = await prisma.shipment.update({ where: { id }, data: { status: action as ShipmentStatus } });

  await prisma.trackingEvent.create({
    data: {
      shipmentId: shipment.id,
      status: action as ShipmentStatus,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      notes: notes ? `Scan gudang: ${notes}` : 'Scan gudang (barcode/QR)',
      createdBy: session?.id,
    },
  });

  await prisma.notification.create({
    data: {
      shipmentId: shipment.id,
      message: `${shipment.trackingNumber}: scan gudang → ${STATUS_LABELS[action] || action}`,
    },
  });

  await logAudit(session, 'WAREHOUSE_SCAN', 'SHIPMENT', `${shipment.trackingNumber} -> ${action}`);

  return NextResponse.json({ scan, shipment: updated }, { status: 201 });
}
