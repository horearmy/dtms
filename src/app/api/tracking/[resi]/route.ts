import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ resi: string }> }) {
  const { resi } = await params;
  const num = resi.toUpperCase().trim();

  const shipment = await prisma.shipment.findUnique({
    where: { trackingNumber: num },
    include: {
      sender: true,
      receiver: true,
      events: { orderBy: { createdAt: 'asc' } },
      pods: true,
      assignments: { include: { driver: true, vehicle: true } },
    },
  });

  if (!shipment) {
    return NextResponse.json({ error: 'Nomor resi tidak ditemukan' }, { status: 404 });
  }

  // estimasi ETA sederhana berdasarkan SLA service type
  const eta = estimateETA(shipment.serviceType, shipment.createdAt);

  return NextResponse.json({
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    origin: shipment.origin,
    destination: shipment.destination,
    receiver: shipment.receiver,
    driver: shipment.assignments[0]?.driver.name || null,
    vehicle: shipment.assignments[0]?.vehicle?.vehicleNumber || null,
    createdAt: shipment.createdAt,
    eta,
    pod: shipment.pods[0] || null,
    timeline: shipment.events.map((e) => ({
      status: e.status,
      notes: e.notes,
      lat: e.latitude,
      lng: e.longitude,
      createdAt: e.createdAt,
    })),
  });
}

function estimateETA(service: string, createdAt: Date) {
  const hours = service === 'SAME_DAY' ? 12 : service === 'NEXT_DAY' ? 24 : 96;
  return new Date(createdAt.getTime() + hours * 3600000);
}