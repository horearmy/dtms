import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  const user = await prisma.user.findUnique({ where: { id: session?.id || '' } });
  if (!user?.email) return NextResponse.json({ orders: [] });

  const customer = await prisma.customer.findFirst({
    where: { tenantId: session?.tenantId || '', email: user.email },
  });
  if (!customer) return NextResponse.json({ orders: [] });

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: { shipment: { select: { trackingNumber: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      destination: o.destAddress,
      status: o.status,
      serviceType: o.serviceType,
      createdAt: o.createdAt.toISOString(),
      shipmentTrackingNumber: o.shipment?.trackingNumber || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

  const user2 = await prisma.user.findUnique({ where: { id: session?.id || '' } });
  if (!user2?.email) return NextResponse.json({ error: 'Customer tidak terdaftar' }, { status: 403 });

  const customer = await prisma.customer.findFirst({
    where: { tenantId: session?.tenantId || '', email: user2.email },
  });
  if (!customer) return NextResponse.json({ error: 'Customer tidak terdaftar' }, { status: 403 });

  const body = await req.json();
  const { destination, receiverName, receiverPhone, serviceType, notes } = body;

  if (!destination || !receiverName) {
    return NextResponse.json({ error: 'destination dan receiverName wajib' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: session?.tenantId || '' } });
  const tenantCode = tenant?.code || 'TENANT';

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await prisma.order.count({ where: { tenantId: session?.tenantId || '' } });
  const orderNumber = `ORD-${tenantCode}-${dateStr}-${String(count + 1).padStart(4, '0')}`;

  const order = await prisma.order.create({
    data: {
      tenantId: session?.tenantId || '',
      customerId: customer.id,
      orderNumber,
      source: 'MANUAL',
      customerName: receiverName,
      customerPhone: receiverPhone || customer.phone,
      destName: receiverName,
      destAddress: destination,
      destPhone: receiverPhone || null,
      serviceType: serviceType || 'REGULAR',
      notes: notes || null,
      status: 'DRAFT',
      weight: 1,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
