import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { STATUS_LABELS } from '@/lib/constants';
import {
  VALID_SHIPMENT_STATUSES,
  WAREHOUSE_FLOW,
  WAREHOUSE_FLOW_LABEL,
  applyStatusTransition,
  notifyStatusChange,
} from '@/lib/shipment-transitions';

function isValidShipmentStatus(value: string): value is (typeof VALID_SHIPMENT_STATUSES)[number] {
  return (VALID_SHIPMENT_STATUSES as readonly string[]).includes(value);
}

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
    if (!isValidShipmentStatus(trimmedAction)) {
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

    const allowed = WAREHOUSE_FLOW[shipment.status];
    if (!allowed || !(allowed as readonly string[]).includes(trimmedAction)) {
      return NextResponse.json(
        {
          error: allowed
            ? `Alur gudang hanya mengizinkan ${allowed.map((s) => STATUS_LABELS[s]).join(' / ')} saat ini, bukan ${STATUS_LABELS[trimmedAction] || trimmedAction}`
            : WAREHOUSE_FLOW_LABEL,
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

    let event;
    let updated;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const transitioned = await applyStatusTransition(tx, {
          shipmentId: shipment.id,
          status: trimmedAction,
          lat: parsedLat,
          lng: parsedLng,
          notes: sanitizedNotes,
          createdBy: session?.id,
          notifyMessage: `${shipment.trackingNumber}: ${STATUS_LABELS[trimmedAction] || trimmedAction}`,
        });
        await (tx as { warehouseScan: { create: (args: unknown) => Promise<unknown> } }).warehouseScan.create({
          data: {
            shipmentId: shipment.id,
            action: trimmedAction,
            scannedBy: session?.id,
            latitude: parsedLat,
            longitude: parsedLng,
            notes: sanitizedNotes,
          },
        });
        return transitioned;
      });
      event = result.event;
      updated = result.updated;
    } catch (txErr) {
      console.error('[scan POST] transaction error', txErr);
      return NextResponse.json({ error: 'Gagal menyimpan hasil scan' }, { status: 500 });
    }

    await notifyStatusChange(shipment.id, trimmedAction, sanitizedNotes);

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
