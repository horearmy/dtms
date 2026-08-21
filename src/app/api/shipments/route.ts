import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant, guardPlanLimit, safeJson } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { coordForCity } from '@/lib/constants';
import { slaDeadlineFor } from '@/lib/eta';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const q = req.nextUrl.searchParams.get('q') || '';
    const status = req.nextUrl.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));

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

    const [total, shipments] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sender: true,
          receiver: true,
          assignments: { include: { driver: true, vehicle: true } },
          stops: { orderBy: { seq: 'asc' } },
        },
      }),
    ]);
    return NextResponse.json({ items: shipments, total, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.CREATE);
  if (error) return error;
  const limitError = await guardPlanLimit(session, 'shipments');
  if (limitError) return limitError;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const { body, error: bodyErr } = await safeJson(req);
    if (bodyErr) return bodyErr;

    const weight = Number(body.weight);
    if (!body.weight || !Number.isFinite(weight) || weight <= 0) {
      return NextResponse.json({ error: 'Berat wajib diisi dan harus lebih dari 0' }, { status: 400 });
    }

    // Daftar perjalanan (stops). Bila tidak dikirim, dibentuk dari sender+receiver lama.
    let stopsIn = Array.isArray(body.stops) && body.stops.length ? body.stops : null;
    if (!stopsIn) {
      if (!body.senderId || !body.receiverId) {
        return NextResponse.json({ error: 'Pengirim dan penerima wajib diisi' }, { status: 400 });
      }
      stopsIn = [
        { seq: 0, customerId: body.senderId, label: body.origin || 'Pengirim', city: body.origin || null },
        { seq: 1, customerId: body.receiverId, label: body.destination || 'Penerima', city: body.destination || null },
      ];
    }

    const toNum = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v :
      typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

    const stopsData = (stopsIn as Array<Record<string, unknown>>)
      .sort((a, b) => Number(a.seq ?? 0) - Number(b.seq ?? 0))
      .map((s, i) => {
        const city = (s.city as string) || null;
        const cc = city ? coordForCity(city) : null;
        return {
          seq: i,
          customerId: (s.customerId as string) || null,
          label: (s.label as string) || city || `Perhentian ${i + 1}`,
          address: (s.address as string) || null,
          city,
          postalCode: (s.postalCode as string) || null,
          latitude: toNum(s.lat) ?? toNum(s.latitude) ?? cc?.lat ?? null,
          longitude: toNum(s.lng) ?? toNum(s.longitude) ?? cc?.lng ?? null,
        };
      });

    const senderStop = stopsData[0];
    const lastStop = stopsData[stopsData.length - 1];
    const receiverId = lastStop.customerId;
    if (!senderStop.customerId || !receiverId) {
      return NextResponse.json({ error: 'Pengirim dan minimal satu tujuan wajib dipilih' }, { status: 400 });
    }

    let trackingNumber = '';
    const created = await prisma.$transaction(async (tx) => {
      const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let seq = await tx.shipment.count({ where: { trackingNumber: { startsWith: `DTMS-${ymd}-` } } });
      do {
        seq++;
        trackingNumber = `DTMS-${ymd}-${String(seq).padStart(6, '0')}`;
      } while (await tx.shipment.findUnique({ where: { trackingNumber } }));

      const origin = senderStop.label;
      const destination = lastStop.label;
      const validServiceTypes = ['REGULAR', 'NEXT_DAY', 'SAME_DAY'];
      const serviceType = validServiceTypes.includes(String(body.serviceType)) ? String(body.serviceType) as 'REGULAR' | 'NEXT_DAY' | 'SAME_DAY' : 'REGULAR';

      const shipment = await tx.shipment.create({
        data: {
          trackingNumber,
          tenantId: session?.tenantId ?? null,
          senderId: senderStop.customerId as string,
          receiverId,
          origin,
          destination,
          originLat: senderStop.latitude,
          originLng: senderStop.longitude,
          destLat: lastStop.latitude,
          destLng: lastStop.longitude,
          weight,
          volume: body.volume ? Number(body.volume) : null,
          serviceType,
          fragile: !!body.fragile,
          itemName: String(body.itemName || 'Paket'),
          itemCount: Number(body.itemCount) || 1,
          itemCategory: body.itemCategory ? String(body.itemCategory) : null,
          itemValue: body.itemValue ? Number(body.itemValue) : null,
          slaDeadline: slaDeadlineFor(serviceType, new Date()),
          deliveryTarget: body.deliveryTarget ? new Date(String(body.deliveryTarget)) : null,
          stops: { create: stopsData },
          items: Array.isArray(body.items) && body.items.length
            ? { create: (body.items as Array<Record<string, unknown>>).map((it) => ({ itemName: String(it.itemName || 'Paket'), quantity: Number(it.quantity) || 1, weight: it.weight != null ? Number(it.weight) : null, dimension: it.dimension ? String(it.dimension) : null })) }
            : { create: { itemName: String(body.itemName || 'Paket'), quantity: Number(body.itemCount) || 1, weight } },
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

    await logAudit(session, 'CREATE_SHIPMENT', 'SHIPMENT', { newData: { trackingNumber, origin: created.origin, destination: created.destination, serviceType: created.serviceType } }, req);
    return NextResponse.json(created, { status: 201 });
  });
}