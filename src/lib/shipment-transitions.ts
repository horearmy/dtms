import { ShipmentStatus } from '@prisma/client';
import { prisma } from './prisma';
import { STATUS_LABELS } from './constants';
import { isWhatsAppEnabled, sendShipmentStatusUpdate, sendDeliveryFailedAlert } from './whatsapp';

export const VALID_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'SORTING',
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'DELIVERY_FAILED', 'RESCHEDULED', 'RETURN_TO_SENDER', 'RETURNED',
];

// Status yang dianggap "menunggu scan gudang" dari sisi driver (satu scan cukup).
export const PRE_DISPATCH_STATUSES: readonly ShipmentStatus[] = [
  'WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP',
];

// Kemajuan perjalanan driver satu-langkah.
export const DRIVER_FLOW: Record<string, ShipmentStatus> = {
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED_AT_HUB',
  ARRIVED_AT_HUB: 'OUT_FOR_DELIVERY',
};

// Status kegagalan/deadend yang boleh dilaporkan langsung oleh driver saat on-road.
export const DRIVER_FAILURE_STATUSES: readonly ShipmentStatus[] = ['DELIVERY_FAILED', 'RESCHEDULED'];

// Status "sedang jalan" tempat driver (atau admin) boleh menandai kegagalan.
export const ON_ROAD_FLOW_STATUSES: readonly ShipmentStatus[] = [
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY',
];

// Alur gudang. WAREHOUSE_RECEIVED boleh menuju SORTING (opsional) atau langsung DISPATCHED;
// SORTING menuju DISPATCHED. Alur driver "satu scan" tidak berubah.
export const WAREHOUSE_FLOW: Record<string, readonly ShipmentStatus[]> = {
  ORDER_CREATED: ['WAREHOUSE_RECEIVED'],
  PICKUP_SCHEDULED: ['WAREHOUSE_RECEIVED'],
  PICKED_UP: ['WAREHOUSE_RECEIVED'],
  WAREHOUSE_RECEIVED: ['SORTING', 'DISPATCHED'],
  SORTING: ['DISPATCHED'],
};

export const WAREHOUSE_FLOW_LABEL =
  'Alur gudang: ORDER_CREATED → WAREHOUSE_RECEIVED → (SORTING opsional) → DISPATCHED';

type TransitionTx = {
  trackingEvent: { create: (...args: any[]) => Promise<{ id: string }> };
  shipment: { update: (...args: any[]) => Promise<{ id: string; status: string }> };
  notification: { create: (...args: any[]) => Promise<unknown> };
};

export type TransitionInput = {
  shipmentId: string;
  status: ShipmentStatus;
  createdBy?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  notifyMessage?: string;
};

export type TransitionOutput = {
  event: { id: string };
  updated: { id: string; status: string };
};

// Satu jalur resmi perubahan status dalam transaksi: trackingEvent + shipment.update +
// notifikasi. Dipanggil dengan tx dari prisma.$transaction untuk konsistensi.
export async function applyStatusTransition(
  tx: TransitionTx,
  input: TransitionInput
): Promise<TransitionOutput> {
  const event = (await tx.trackingEvent.create({
    data: {
      shipmentId: input.shipmentId,
      status: input.status as never,
      latitude: input.lat ?? null,
      longitude: input.lng ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    },
  })) as TransitionOutput['event'];

  const updated = (await tx.shipment.update({
    where: { id: input.shipmentId },
    data: { status: input.status as never },
  })) as TransitionOutput['updated'];

  await tx.notification.create({
    data: {
      shipmentId: input.shipmentId,
      message: input.notifyMessage || `${STATUS_LABELS[input.status] || input.status}`,
    },
  });

  return { event, updated };
}

// Side-effect non-kritikal: kirim notifikasi status ke penerima via WhatsApp.
export async function notifyStatusChange(
  shipmentId: string,
  targetStatus: ShipmentStatus,
  notes?: string | null
) {
  if (!isWhatsAppEnabled()) return;
  try {
    const full = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { receiver: true },
    });
    if (!full?.receiver?.phone) return;
    if (targetStatus === 'DELIVERY_FAILED') {
      await sendDeliveryFailedAlert(full.trackingNumber, full.receiver.name, notes || 'Tidak diketahui');
    } else if (targetStatus === 'RETURNED' || targetStatus === 'RETURN_TO_SENDER') {
      await sendDeliveryFailedAlert(
        full.trackingNumber,
        full.receiver.name,
        `Paket dikembalikan: ${notes || 'Tidak diketahui'}`
      );
    } else {
      await sendShipmentStatusUpdate(
        full.trackingNumber,
        targetStatus,
        full.receiver.phone,
        full.receiver.name,
        full.destination,
        full.slaDeadline
      );
    }
  } catch {
    // WhatsApp bersifat non-kritikal, jangan gagalkan request utama.
  }
}
