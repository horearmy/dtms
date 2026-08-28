import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { STATUS_LABELS } from '@/lib/constants';
import { isWhatsAppEnabled, sendShipmentStatusUpdate, sendDeliveryFailedAlert } from '@/lib/whatsapp';

const VALID_SHIPMENT_STATUSES = [
  'ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'SORTING',
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'DELIVERY_FAILED', 'RESCHEDULED', 'RETURN_TO_SENDER', 'RETURNED',
] as const;

const DRIVER_FLOW: Record<string, string> = {
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED_AT_HUB',
  ARRIVED_AT_HUB: 'OUT_FOR_DELIVERY',
};

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
    if (!(VALID_SHIPMENT_STATUSES as readonly string[]).includes(trimmedStatus)) {
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

    const event = await prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status: trimmedStatus as never,
        latitude: parsedLat,
        longitude: parsedLng,
        notes: sanitizedNotes,
        createdBy: session?.id,
      },
    });

    const updated = await prisma.shipment.update({
      where: { id },
      data: { status: trimmedStatus as never },
    });

    await prisma.notification.create({
      data: {
        shipmentId: id,
        message: `${shipment.trackingNumber}: ${STATUS_LABELS[trimmedStatus] || trimmedStatus}`,
      },
    });

    if (trimmedStatus === 'IN_TRANSIT' && session?.role === 'DRIVER') {
      await prisma.notification.create({
        data: {
          userId: session.id,
          tenantId: session.tenantId,
          type: 'INFO',
          title: 'Hati-hati selama perjalanan',
          message: `Hati-hati selama perjalanan — ${shipment.trackingNumber} telah berangkat menuju ${shipment.destination}. Selamat bertugas!`,
        },
      });
    }

    await logAudit(
      session,
      'UPDATE_STATUS',
      'SHIPMENT',
      { oldData: { status: shipment.status }, newData: { status: trimmedStatus, notes: sanitizedNotes } },
      req
    );

    if (isWhatsAppEnabled()) {
      try {
        const fullShipment = await prisma.shipment.findUnique({
          where: { id },
          include: { receiver: true },
        });
        if (fullShipment?.receiver?.phone) {
          if (trimmedStatus === 'DELIVERY_FAILED') {
            await sendDeliveryFailedAlert(
              shipment.trackingNumber,
              fullShipment.receiver.name,
              sanitizedNotes || 'Tidak diketahui'
            );
          } else if (trimmedStatus === 'RETURNED' || trimmedStatus === 'RETURN_TO_SENDER') {
            await sendDeliveryFailedAlert(
              shipment.trackingNumber,
              fullShipment.receiver.name,
              `Paket dikembalikan: ${sanitizedNotes || 'Tidak diketahui'}`
            );
          } else {
            const sla = fullShipment.slaDeadline;
            await sendShipmentStatusUpdate(
              shipment.trackingNumber,
              trimmedStatus,
              fullShipment.receiver.phone,
              fullShipment.receiver.name,
              fullShipment.destination,
              sla
            );
          }
        }
      } catch {
        // WhatsApp send is non-critical, don't fail the request
      }
    }

    return NextResponse.json({ event, shipment: updated });
  });
}