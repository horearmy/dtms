import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

  const shipmentId = req.nextUrl.searchParams.get('shipmentId');
  if (!shipmentId) {
    return NextResponse.json({ error: 'shipmentId wajib diisi' }, { status: 400 });
  }

  const events = await prisma.shipmentEvent.findMany({
    where: { shipmentId },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'DRIVER');
  if (error) return error;

  const body = await req.json();
  const { shipmentId, eventType, latitude, longitude, notes, metadata } = body;

  if (!shipmentId || !eventType) {
    return NextResponse.json({ error: 'shipmentId dan eventType wajib diisi' }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, select: { id: true, status: true, tenantId: true } });
  if (!shipment) {
    return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });
  }

  const event = await prisma.shipmentEvent.create({
    data: {
      tenantId: session?.tenantId || shipment.tenantId,
      shipmentId,
      eventType,
      previousStatus: shipment.status,
      actorType: session?.role || 'SYSTEM',
      actorId: session?.id || null,
      metadata: notes ? String(notes).slice(0, 1000) : metadata ? JSON.stringify(metadata) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
