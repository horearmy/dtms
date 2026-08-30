import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { STATUS_LABELS } from '@/lib/constants';

const VALID_SHIPMENT_STATUSES = [
  'ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'SORTING',
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'DELIVERY_FAILED', 'RESCHEDULED', 'RETURN_TO_SENDER', 'RETURNED',
] as const;

const WAREHOUSE_FLOW: Record<string, string> = {
  ORDER_CREATED: 'WAREHOUSE_RECEIVED',
  PICKUP_SCHEDULED: 'WAREHOUSE_RECEIVED',
  PICKED_UP: 'WAREHOUSE_RECEIVED',
  WAREHOUSE_RECEIVED: 'DISPATCHED',
  SORTING: 'DISPATCHED',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.SCAN);
  if (error) return error;

  if (session?.role === 'DRIVER') {
    return NextResponse.json(
      { error: 'Scan gudang hanya untuk petugas gudang/ops, bukan driver' },
      { status: 403 }
    );
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json().catch(() => ({}));
    const { action, notes, lat, lng } = body || {};

    const trimmedAction = String(action || '').trim();
    if (!trimmedAction) {
      return NextResponse.json({ error: 'Action wajib diisi' }, { status: 400 });
    }
    if (!(VALID_SHIPMENT_STATUSES as readonly string[]).includes(trimmedAction)) {
      return NextResponse.json({ error: `Status tidak valid. Nilai yang diizinkan: ${VALID_SHIPMENT_STATUSES.join(', ')}` }, { status: 400 });
    }

    const sanitizedNotes = notes ? String(notes).trim().slice(0, 500) : null;
    let parsedLat: number | null = null;
    let parsedLng: number | null = null;
    if (lat != null && lat !== '') {
      const n = Number(lat);
      if (isNaN(n) || n < -90 || n > 90) {
        return NextResponse.json({ error: 'Latitude harus antara -90 dan 90' }, { status: 400 });
      }
      parsedLat = n;
    }
    if (lng != null && lng !== '') {
      const n = Number(lng);
      if (isNaN(n) || n < -180 || n > 180) {
        return NextResponse.json({ error: 'Longitude harus antara -180 dan 180' }, { status: 400 });
      }
      parsedLng = n;
    }

    const shipment = await prisma.shipment.findUnique({ where: { id } });
    if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

    if (['DELIVERED', 'RETURNED'].includes(shipment.status)) {
      return NextResponse.json({ error: 'Shipment sudah selesai (terminal status)' }, { status: 400 });
    }

    const expected = WAREHOUSE_FLOW[shipment.status];
    if (!expected || trimmedAction !== expected) {
      return NextResponse.json(
        {
          error: expected
            ? `Alur gudang hanya mengizinkan ${STATUS_LABELS[expected]} saat ini, bukan ${STATUS_LABELS[trimmedAction] || trimmedAction}`
            : 'Status saat ini di luar alur gudang (ORDER_CREATED → WAREHOUSE_RECEIVED → DISPATCHED)',
        },
        { status: 400 }
      );
    }

    if (trimmedAction === 'DISPATCHED') {
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
      if (vehicle.returning) {
        return NextResponse.json(
          { error: 'Kendaraan sedang kembali ke gudang. Selesaikan status kembali terlebih dahulu.' },
          { status: 400 }
        );
      }
    }

    const event = await prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: trimmedAction as never,
        latitude: parsedLat,
        longitude: parsedLng,
        notes: sanitizedNotes,
        createdBy: session?.id,
      },
    });

    const updated = await prisma.shipment.update({
      where: { id },
      data: { status: trimmedAction as never },
    });

    await prisma.warehouseScan.create({
      data: {
        shipmentId: shipment.id,
        action: trimmedAction,
        scannedBy: session?.id,
        latitude: parsedLat,
        longitude: parsedLng,
        notes: sanitizedNotes,
      },
    });

    await prisma.notification.create({
      data: {
        shipmentId: id,
        message: `${shipment.trackingNumber}: ${STATUS_LABELS[trimmedAction] || trimmedAction}`,
      },
    });

    await logAudit(
      session,
      'WAREHOUSE_SCAN',
      'SHIPMENT',
      { oldData: { status: shipment.status }, newData: { status: trimmedAction, notes: sanitizedNotes } },
      req
    );

    return NextResponse.json({ event, shipment: updated });
  });
}
