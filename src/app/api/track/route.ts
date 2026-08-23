// src/app/api/track/route.ts
// Public tracking lookup — no auth required. Returns safe DTO only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateEta } from '@/lib/eta-engine';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Pesanan Dibuat',
  PENDING_PICKUP: 'Menunggu Penjemputan',
  PICKED_UP: 'Telah Diambil',
  IN_WAREHOUSE: 'Di Gudang',
  OUT_FOR_DELIVERY: 'Sedang Diantar',
  DELIVERED: 'Terkirim',
  DELIVERY_FAILED: 'Gagal Dikirim',
  RETURNED: 'Dikembalikan',
  CANCELLED: 'Dibatalkan',
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const trackingNumber = url.searchParams.get('q')?.trim();

  if (!trackingNumber || trackingNumber.length < 6) {
    return NextResponse.json({ error: 'Masukkan nomor tracking yang valid.' }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber },
    select: {
      id: true,
      trackingNumber: true,
      origin: true,
      destination: true,
      status: true,
      serviceType: true,
      itemName: true,
      itemCount: true,
      weight: true,
      createdAt: true,
      updatedAt: true,
      slaDeadline: true,
      originLat: true,
      originLng: true,
      destLat: true,
      destLng: true,
      sender: { select: { name: true } },
      receiver: { select: { name: true } },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { status: true, notes: true, latitude: true, longitude: true, createdAt: true },
      },
      pods: {
        orderBy: { deliveredAt: 'desc' },
        take: 1,
        select: { receiverName: true, deliveredAt: true, notes: true },
      },
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: 'Nomor tracking tidak ditemukan.' }, { status: 404 });
  }

  return NextResponse.json({
    trackingNumber: shipment.trackingNumber,
    origin: shipment.origin,
    destination: shipment.destination,
    status: shipment.status,
    statusLabel: STATUS_LABELS[shipment.status] || shipment.status,
    serviceType: shipment.serviceType,
    itemName: shipment.itemName,
    itemCount: shipment.itemCount,
    weight: shipment.weight,
    sender: shipment.sender?.name || '-',
    receiver: shipment.receiver?.name || '-',
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    slaDeadline: shipment.slaDeadline,
    timeline: shipment.events.map((e) => ({
      status: e.status,
      statusLabel: STATUS_LABELS[e.status] || e.status,
      location: e.latitude != null && e.longitude != null ? `${e.latitude}, ${e.longitude}` : null,
      notes: e.notes,
      timestamp: e.createdAt,
    })),
    pod: shipment.pods[0] || null,
  });
}
