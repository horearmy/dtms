import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

function generateOrderNumber(tenantCode: string, index: number) {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${tenantCode}-${ymd}-${String(index).padStart(4, '0')}`;
}

export async function GET(req: NextRequest) {
  const { session, error } = await guard();
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
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'CUSTOMER_SERVICE');
  if (error) return error;

  const body = await req.json();
  const {
    customerName, customerPhone, customerEmail,
    destName, destAddress, destCity, destLat, destLng,
    serviceType, weight, volume, fragile, itemValue,
    items, notes,
  } = body;

  if (!customerName || !customerPhone || !destName || !destAddress || !weight) {
    return NextResponse.json({ error: 'Data wajib tidak lengkap' }, { status: 400 });
  }

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
      customerName: String(customerName).slice(0, 100),
      customerPhone: String(customerPhone).slice(0, 20),
      customerEmail: customerEmail ? String(customerEmail).slice(0, 150) : null,
      destName: String(destName).slice(0, 100),
      destAddress: String(destAddress).slice(0, 255),
      destCity: destCity ? String(destCity).slice(0, 100) : null,
      destLat: destLat ? parseFloat(destLat) : null,
      destLng: destLng ? parseFloat(destLng) : null,
      serviceType: serviceType || 'REGULAR',
      weight: parseFloat(weight),
      volume: volume ? parseFloat(volume) : null,
      fragile: !!fragile,
      itemValue: itemValue ? parseFloat(itemValue) : null,
      notes: notes ? String(notes).slice(0, 500) : null,
      branchId: session?.branchId || null,
      createdBy: session?.id || null,
      status: 'RECEIVED',
      items: items?.length
        ? { create: items.map((i: { itemName: string; quantity?: number; weight?: number; dimension?: string }) => ({
            itemName: String(i.itemName).slice(0, 100),
            quantity: i.quantity || 1,
            weight: i.weight ? parseFloat(String(i.weight)) : null,
            dimension: i.dimension ? String(i.dimension).slice(0, 50) : null,
          })) }
        : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}
