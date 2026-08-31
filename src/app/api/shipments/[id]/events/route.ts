import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { STATUS_LABELS } from '@/lib/constants';
import {
  VALID_SHIPMENT_STATUSES,
  DRIVER_FLOW,
  DRIVER_FAILURE_STATUSES,
  ON_ROAD_FLOW_STATUSES,
  applyStatusTransition,
  notifyStatusChange,
} from '@/lib/shipment-transitions';

function isValidShipmentStatus(value: string): value is (typeof VALID_SHIPMENT_STATUSES)[number] {
  return (VALID_SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.UPDATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { status, notes, lat, lng } = body || {};

    const trimmedStatus = String(status || '').trim();
    if (!trimmedStatus) {
      return NextResponse.json({ error: 'Status wajib diisi' }, { status: 400 });
    }
    if (!isValidShipmentStatus(trimmedStatus)) {
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

    // Status maju/perjalanan hanya dijalankan oleh driver (via aplikasi driver)
    // atau scan gudang (via route scan / dispatch-driver yang khusus).
    // Admin/ops setelah pembuatan shipment hanya memantau dan boleh menandai
    // gagal/jadwal ulang/return — tidak boleh memajukan status perjalanan manual.
    if (session?.role !== 'DRIVER') {
      const forwardOnly = ['WAREHOUSE_RECEIVED', 'SORTING', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED'];
      if ((forwardOnly as readonly string[]).includes(trimmedStatus)) {
        return NextResponse.json(
          { error: `Status ${STATUS_LABELS[trimmedStatus] || trimmedStatus} tidak dapat diubah manual. Perjalanan dijalankan via scan gudang / driver.` },
          { status: 403 }
        );
      }
    }

    // Status DELIVERED hanya boleh dicapai lewat POD yang dibuat oleh driver yang ditugaskan.
    if (trimmedStatus === 'DELIVERED' && session?.role !== 'DRIVER') {
      return NextResponse.json(
        { error: 'Penyelesaian pengiriman (DELIVERED) hanya dapat dilakukan oleh driver via laporan penerimaan (POD)' },
        { status: 403 }
      );
    }

    if (session?.role === 'DRIVER') {
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

      // Jalur kegagalan: driver boleh melaporkan Gagal / Jadwal Ulang saat perjalanan berlangsung.
      if ((DRIVER_FAILURE_STATUSES as readonly string[]).includes(trimmedStatus)) {
        if (!(ON_ROAD_FLOW_STATUSES as readonly string[]).includes(shipment.status)) {
          return NextResponse.json(
            {
              error: `Status ${STATUS_LABELS[trimmedStatus] || trimmedStatus} hanya dapat dilaporkan saat pengiriman berlangsung (${ON_ROAD_FLOW_STATUSES.map((s) => STATUS_LABELS[s]).join(', ')})`,
            },
            { status: 400 }
          );
        }
      } else {
        const expected = DRIVER_FLOW[shipment.status];
        if (!expected || trimmedStatus !== expected) {
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
    }

    if (trimmedStatus === 'DISPATCHED') {
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
      const result = await prisma.$transaction((tx) =>
        applyStatusTransition(tx, {
          shipmentId: shipment.id,
          status: trimmedStatus,
          lat: parsedLat,
          lng: parsedLng,
          notes: sanitizedNotes,
          createdBy: session?.id,
          notifyMessage: `${shipment.trackingNumber}: ${STATUS_LABELS[trimmedStatus] || trimmedStatus}`,
        })
      );
      event = result.event;
      updated = result.updated;
    } catch (txErr) {
      console.error('[events POST] transaction error', txErr);
      return NextResponse.json({ error: 'Gagal memperbarui status shipment' }, { status: 500 });
    }

    if (trimmedStatus === 'IN_TRANSIT' && session?.role === 'DRIVER') {
      try {
        await prisma.notification.create({
          data: {
            userId: session.id,
            tenantId: session.tenantId,
            type: 'INFO',
            title: 'Hati-hati selama perjalanan',
            message: `Hati-hati selama perjalanan — ${shipment.trackingNumber} telah berangkat menuju ${shipment.destination}. Selamat bertugas!`,
          },
        });
      } catch {
        // non-critical
      }
    }

    await notifyStatusChange(shipment.id, trimmedStatus, sanitizedNotes);

    await logAudit(
      session,
      'UPDATE_STATUS',
      'SHIPMENT',
      { oldData: { status: shipment.status }, newData: { status: trimmedStatus, notes: sanitizedNotes } },
      req
    );

    return NextResponse.json({ event, shipment: updated });
  });
}
