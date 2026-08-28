import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { STATUS_LABELS } from '@/lib/constants';

const PRE_DISPATCH_STATUSES = ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP'] as const;

function parseDispatchCode(raw: string): { employeeId: string; shipmentId: string } | null {
  const trimmed = String(raw || '').trim();
  const m = trimmed.match(/^DRV:([^:]+):SHP:(.+)$/);
  if (!m) return null;
  const employeeId = m[1].trim();
  const shipmentId = m[2].trim();
  if (!employeeId || !shipmentId) return null;
  return { employeeId, shipmentId };
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.SCAN);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json().catch(() => ({}));
    const { code, lat, lng } = body || {};

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Kode QR driver wajib diisi' }, { status: 400 });
    }

    const parsed = parseDispatchCode(code);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Format QR tidak valid. Pindai QR keberangkatan dari aplikasi driver.' },
        { status: 400 }
      );
    }

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

    const driver = await prisma.driver.findUnique({ where: { employeeId: parsed.employeeId } });
    if (!driver) {
      return NextResponse.json({ error: 'Driver tidak ditemukan untuk kode ini' }, { status: 404 });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: parsed.shipmentId } });
    if (!shipment) {
      return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });
    }

    if (['DELIVERED', 'RETURNED', 'RETURN_TO_SENDER'].includes(shipment.status)) {
      return NextResponse.json({ error: 'Shipment sudah selesai' }, { status: 400 });
    }

    if (shipment.status === 'DISPATCHED' || shipment.status === 'IN_TRANSIT'
      || shipment.status === 'ARRIVED_AT_HUB' || shipment.status === 'OUT_FOR_DELIVERY') {
      return NextResponse.json(
        { error: 'Shipment sudah diberangkatkan. Status saat ini: ' + (STATUS_LABELS[shipment.status] || shipment.status) },
        { status: 400 }
      );
    }

    if (!(PRE_DISPATCH_STATUSES as readonly string[]).includes(shipment.status as never)) {
      return NextResponse.json(
        { error: `Status saat ini (${STATUS_LABELS[shipment.status] || shipment.status}) belum siap diberangkatkan. Verifikasi di gudang terlebih dahulu.` },
        { status: 400 }
      );
    }

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { shipmentId: shipment.id },
    });

    if (!assignment?.driverId || !assignment?.vehicleId) {
      return NextResponse.json(
        { error: 'Lengkapi penugasan terlebih dahulu: pilih driver dan kendaraan sebelum keberangkatan' },
        { status: 400 }
      );
    }

    if (assignment.driverId !== driver.id) {
      return NextResponse.json(
        { error: `QR driver (${driver.name}) tidak cocok dengan driver yang ditugaskan untuk shipment ini` },
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

    const event = await prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: 'DISPATCHED',
        latitude: parsedLat,
        longitude: parsedLng,
        notes: `Diberangkatkan oleh gudang — diverifikasi via QR driver ${driver.employeeId}`,
        createdBy: session?.id,
      },
    });

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: { status: 'DISPATCHED' },
    });

    await prisma.warehouseScan.create({
      data: {
        shipmentId: shipment.id,
        action: 'DISPATCHED',
        scannedBy: session?.id,
        latitude: parsedLat,
        longitude: parsedLng,
        notes: `QR driver ${driver.employeeId} (${driver.name})`,
      },
    });

    await prisma.notification.create({
      data: {
        shipmentId: shipment.id,
        message: `${shipment.trackingNumber}: ${STATUS_LABELS.DISPATCHED} — diverifikasi via QR driver ${driver.employeeId}`,
      },
    });

    await logAudit(
      session,
      'WAREHOUSE_SCAN_DISPATCH_DRIVER',
      'SHIPMENT',
      {
        oldData: { status: shipment.status, driverId: driver.id, employeeId: driver.employeeId },
        newData: { status: 'DISPATCHED', shipmentId: shipment.id, vehicleId: assignment.vehicleId },
      },
      req
    );

    return NextResponse.json({ driver: driver.name, shipment: updated });
  });
}
