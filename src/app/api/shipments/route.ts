import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { generateTrackingNumber } from '@/lib/constants';
import { coordForCity } from '@/lib/constants';
import { slaDeadlineFor } from '@/lib/eta';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'CUSTOMER_SERVICE', 'WAREHOUSE', 'SUPERVISOR'];

export async function GET(req: NextRequest) {
  const { error } = await guard(...MANAGE);
  if (error) return error;
  const q = req.nextUrl.searchParams.get('q') || '';
  const status = req.nextUrl.searchParams.get('status') || '';

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { trackingNumber: { contains: q } },
      { sender: { is: { name: { contains: q } } } },
      { receiver: { is: { name: { contains: q } } } },
      { destination: { contains: q } },
    ];
  }

  const shipments = await prisma.shipment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { sender: true, receiver: true, assignments: { include: { driver: true, vehicle: true } } },
  });
  return NextResponse.json(shipments);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'CUSTOMER_SERVICE');
  if (error) return error;
  const body = await req.json();

  if (!body.senderId || !body.receiverId || !body.weight) {
    return NextResponse.json({ error: 'Pengirim, penerima, dan berat wajib diisi' }, { status: 400 });
  }

  let trackingNumber = '';
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.shipment.count();
    trackingNumber = `DTMS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(6, '0')}`;
    if (count >= 10000) trackingNumber = generateTrackingNumber();

    const origin = body.origin || 'Jakarta';
    const destination = body.destination || '-';
    const originC = coordForCity(origin);
    const destC = coordForCity(destination);
    const serviceType = body.serviceType || 'REGULAR';

    const shipment = await tx.shipment.create({
      data: {
        trackingNumber,
        senderId: body.senderId,
        receiverId: body.receiverId,
        origin,
        destination,
        originLat: body.originLat != null ? Number(body.originLat) : originC?.lat ?? null,
        originLng: body.originLng != null ? Number(body.originLng) : originC?.lng ?? null,
        destLat: body.destLat != null ? Number(body.destLat) : destC?.lat ?? null,
        destLng: body.destLng != null ? Number(body.destLng) : destC?.lng ?? null,
        weight: Number(body.weight),
        volume: body.volume ? Number(body.volume) : null,
        serviceType,
        fragile: !!body.fragile,
        itemName: body.itemName || 'Paket',
        itemCount: Number(body.itemCount) || 1,
        itemCategory: body.itemCategory || null,
        itemValue: body.itemValue ? Number(body.itemValue) : null,
        slaDeadline: slaDeadlineFor(serviceType, new Date()),
        deliveryTarget: body.deliveryTarget ? new Date(body.deliveryTarget) : null,
        items: body.items?.length
          ? { create: body.items.map((it: { itemName: string; quantity: number; weight?: number; dimension?: string }) => ({ itemName: it.itemName, quantity: Number(it.quantity) || 1, weight: it.weight ? Number(it.weight) : null, dimension: it.dimension || null })) }
          : { create: { itemName: body.itemName || 'Paket', quantity: Number(body.itemCount) || 1, weight: Number(body.weight) } },
      },
    });
    await tx.trackingEvent.create({
      data: { shipmentId: shipment.id, status: 'ORDER_CREATED', createdBy: session?.id, notes: 'Order dibuat' },
    });
    await tx.notification.create({
      data: { shipmentId: shipment.id, message: `Order baru: ${shipment.trackingNumber} dibuat` },
    });
    return shipment;
  });

  await logAudit(session, 'CREATE_SHIPMENT', 'SHIPMENT', `${trackingNumber}`);
  return NextResponse.json(created, { status: 201 });
}