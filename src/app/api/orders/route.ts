import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

const VALID_SERVICE_TYPES = ['SAME_DAY', 'NEXT_DAY', 'REGULAR'] as const;

function generateOrderNumber(tenantCode: string, index: number) {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${tenantCode}-${ymd}-${String(index).padStart(4, '0')}`;
}

export async function GET(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.ORDER.READ);
  if (error) return error;

  const url = req.nextUrl.searchParams;
  const status = url.get('status') || '';
  const search = url.get('q') || '';
  const page = Math.max(1, parseInt(url.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.get('limit') || '20', 10)));

  const where: Record<string, unknown> = {};
  if (session?.tenantId) where.tenantId = session.tenantId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { destName: { contains: search, mode: 'insensitive' } },
      { destCity: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, shipment: { select: { id: true, trackingNumber: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.ORDER.CREATE);
  if (error) return error;

  const body = await req.json();
  const {
    customerName, customerPhone, customerEmail,
    destName, destAddress, destCity, destLat, destLng,
    serviceType, weight, volume, fragile, itemValue,
    items, notes,
  } = body;

  const trimmedCustomerName = customerName ? String(customerName).trim().slice(0, 100) : '';
  const trimmedCustomerPhone = customerPhone ? String(customerPhone).trim().slice(0, 20) : '';
  const trimmedCustomerEmail = customerEmail ? String(customerEmail).trim().slice(0, 150) : null;
  const trimmedDestName = destName ? String(destName).trim().slice(0, 100) : '';
  const trimmedDestAddress = destAddress ? String(destAddress).trim().slice(0, 255) : '';
  const trimmedDestCity = destCity ? String(destCity).trim().slice(0, 100) : null;
  const trimmedNotes = notes ? String(notes).trim().slice(0, 500) : null;

  if (!trimmedCustomerName || !trimmedCustomerPhone || !trimmedDestName || !trimmedDestAddress) {
    return NextResponse.json({ error: 'Data wajib tidak lengkap (customerName, customerPhone, destName, destAddress)' }, { status: 400 });
  }

  const parsedWeight = Number(weight);
  if (weight == null || isNaN(parsedWeight) || parsedWeight <= 0) {
    return NextResponse.json({ error: 'Weight harus berupa angka positif' }, { status: 400 });
  }

  const trimmedServiceType = serviceType ? String(serviceType).trim() : 'REGULAR';
  if (!(VALID_SERVICE_TYPES as readonly string[]).includes(trimmedServiceType)) {
    return NextResponse.json({ error: `serviceType tidak valid. Nilai yang diizinkan: ${VALID_SERVICE_TYPES.join(', ')}` }, { status: 400 });
  }

  const parsedLat = destLat != null && destLat !== '' ? parseFloat(String(destLat)) : null;
  if (parsedLat !== null && (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
    return NextResponse.json({ error: 'destLat harus antara -90 dan 90' }, { status: 400 });
  }
  const parsedLng = destLng != null && destLng !== '' ? parseFloat(String(destLng)) : null;
  if (parsedLng !== null && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
    return NextResponse.json({ error: 'destLng harus antara -180 dan 180' }, { status: 400 });
  }
  const parsedVolume = volume != null && volume !== '' ? parseFloat(String(volume)) : null;
  if (parsedVolume !== null && isNaN(parsedVolume)) {
    return NextResponse.json({ error: 'volume harus berupa angka' }, { status: 400 });
  }
  const parsedItemValue = itemValue != null && itemValue !== '' ? parseFloat(String(itemValue)) : null;
  if (parsedItemValue !== null && isNaN(parsedItemValue)) {
    return NextResponse.json({ error: 'itemValue harus berupa angka' }, { status: 400 });
  }

  const sanitizedItems = Array.isArray(items) ? items.slice(0, 50) : [];

  const tenant = session?.tenantId
    ? await prisma.tenant.findUnique({ where: { id: session.tenantId } })
    : null;
  const tenantCode = tenant?.code || 'DTMS';

  const count = await prisma.order.count({ where: { tenantId: session?.tenantId || '' } });
  const orderNumber = generateOrderNumber(tenantCode, count + 1);

  const order = await prisma.order.create({
    data: {
      tenantId: session?.tenantId || '',
      orderNumber,
      customerName: trimmedCustomerName,
      customerPhone: trimmedCustomerPhone,
      customerEmail: trimmedCustomerEmail,
      destName: trimmedDestName,
      destAddress: trimmedDestAddress,
      destCity: trimmedDestCity,
      destLat: parsedLat,
      destLng: parsedLng,
      serviceType: trimmedServiceType as never,
      weight: parsedWeight,
      volume: parsedVolume,
      fragile: !!fragile,
      itemValue: parsedItemValue,
      notes: trimmedNotes,
      branchId: session?.branchId || null,
      createdBy: session?.id || null,
      status: 'RECEIVED',
      items: sanitizedItems.length
        ? { create: sanitizedItems.map((i: { itemName: string; quantity?: number; weight?: number; dimension?: string }) => ({
            itemName: String(i.itemName || '').trim().slice(0, 100),
            quantity: Math.max(1, Math.min(10000, Number(i.quantity) || 1)),
            weight: i.weight ? parseFloat(String(i.weight)) : null,
            dimension: i.dimension ? String(i.dimension).trim().slice(0, 50) : null,
          })) }
        : undefined,
    },
    include: { items: true },
  });

  await logAudit(session, 'CREATE_ORDER', 'ORDER', { newData: { destination: destName, receiverName: customerName } }, req);

  return NextResponse.json(order, { status: 201 });
}
