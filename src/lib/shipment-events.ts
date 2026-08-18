import { prisma } from './prisma';
import { broadcast } from './sse-bus';
import type { ShipmentEventType, ShipmentStatus } from '@prisma/client';

type LogShipmentEventParams = {
  tenantId: string | null;
  shipmentId: string;
  eventType: ShipmentEventType;
  previousStatus?: ShipmentStatus | null;
  newStatus?: ShipmentStatus | null;
  actorType?: string;
  actorId?: string;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: string | null;
};

export async function logShipmentEvent(params: LogShipmentEventParams) {
  const { tenantId, shipmentId, eventType, previousStatus, newStatus, actorType, actorId, latitude, longitude, metadata } = params;

  const [event] = await prisma.$transaction([
    prisma.shipmentEvent.create({
      data: {
        tenantId,
        shipmentId,
        eventType,
        previousStatus: previousStatus || null,
        newStatus: newStatus || null,
        actorType: actorType || 'SYSTEM',
        actorId: actorId || null,
        metadata: metadata || null,
        latitude: latitude || null,
        longitude: longitude || null,
      },
    }),
    ...(newStatus
      ? [prisma.shipment.update({ where: { id: shipmentId }, data: { status: newStatus } })]
      : []),
  ]);

  // Broadcast to SSE subscribers
  const channel = tenantId ? `tenant:${tenantId}` : 'global';
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { trackingNumber: true },
  });

  broadcast(channel, 'shipment:event', {
    id: event.id,
    eventType,
    shipmentId,
    trackingNumber: shipment?.trackingNumber || '-',
    previousStatus: previousStatus || null,
    newStatus: newStatus || null,
    occurredAt: event.occurredAt.toISOString(),
  });

  broadcast(channel, 'control-tower:update', {
    type: 'shipment_event',
    eventType,
    trackingNumber: shipment?.trackingNumber || '-',
  });

  return event;
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  SHIPMENT_CREATED: 'Pengiriman Dibuat',
  WAREHOUSE_RECEIVED: 'Diterima di Gudang',
  SORTED: 'Sorting Selesai',
  ASSIGNED: 'Ditugaskan ke Driver',
  DISPATCHED: 'Dikirim',
  GPS_STARTED: 'GPS Dimulai',
  ARRIVED_HUB: 'Tiba di Hub',
  OUT_FOR_DELIVERY: 'Sedang Diantar',
  DELIVERED: 'Terkirim',
  POD_SUBMITTED: 'POD Dikirim',
  POD_VERIFIED: 'POD Terverifikasi',
  COMPLETED: 'Selesai',
  DELIVERY_FAILED: 'Pengiriman Gagal',
  RESCHEDULED: 'Dijadwal Ulang',
  RETURNED: 'Dikembalikan',
  CANCELLED: 'Dibatalkan',
  STATUS_UPDATED: 'Status Diperbarui',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  SHIPMENT_CREATED: 'bg-blue-100 text-blue-700',
  WAREHOUSE_RECEIVED: 'bg-yellow-100 text-yellow-700',
  SORTED: 'bg-purple-100 text-purple-700',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  DISPATCHED: 'bg-cyan-100 text-cyan-700',
  GPS_STARTED: 'bg-green-100 text-green-700',
  ARRIVED_HUB: 'bg-violet-100 text-violet-700',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700',
  POD_SUBMITTED: 'bg-teal-100 text-teal-700',
  POD_VERIFIED: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DELIVERY_FAILED: 'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-amber-100 text-amber-700',
  RETURNED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
  STATUS_UPDATED: 'bg-slate-100 text-slate-700',
};
