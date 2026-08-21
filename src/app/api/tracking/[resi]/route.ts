import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp, checkRateLimit } from '@/lib/security';

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0]?.[0] ? parts[0][0] + '***' : '***';
  const first = parts[0][0] + '***';
  const last = parts[parts.length - 1][0] + '.';
  return `${first} ${last}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 6) return '***' + digits.slice(-2);
  return digits.slice(0, 3) + '***' + digits.slice(-4);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ resi: string }> }) {
  const ip = getClientIp(req);
  if (!await checkRateLimit(`tracking:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Terlalu banyak request, coba lagi nanti' }, { status: 429 });
  }

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

  const maskedReceiver = {
    name: maskName(shipment.receiver.name),
    phone: maskPhone(shipment.receiver.phone),
  };

  return NextResponse.json({
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    origin: shipment.origin,
    destination: shipment.destination,
    receiver: maskedReceiver,
    driver: shipment.assignments[0] ? maskName(shipment.assignments[0].driver.name) : null,
    vehicle: shipment.assignments[0]?.vehicle?.vehicleNumber || null,
    createdAt: shipment.createdAt,
    eta,
    timeline: shipment.events.map((e) => ({
      status: e.status,
      notes: e.notes,
      createdAt: e.createdAt,
    })),
  });
}

function estimateETA(service: string, createdAt: Date) {
  const hours = service === 'SAME_DAY' ? 12 : service === 'NEXT_DAY' ? 24 : 96;
  return new Date(createdAt.getTime() + hours * 3600000);
}
