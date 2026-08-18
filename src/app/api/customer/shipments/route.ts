import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.SHIPMENT.READ);
  if (error) return error;

  // Find customer linked to this user via email
  const user = await prisma.user.findUnique({ where: { id: session?.id || '' } });
  if (!user?.email) {
    return NextResponse.json({ shipments: [] });
  }

  const customer = await prisma.customer.findFirst({
    where: { tenantId: session?.tenantId || '', email: user.email },
  });

  if (!customer) {
    return NextResponse.json({ shipments: [] });
  }

  const shipments = await prisma.shipment.findMany({
    where: { OR: [{ senderId: customer.id }, { receiverId: customer.id }] },
    select: {
      id: true,
      trackingNumber: true,
      destination: true,
      origin: true,
      status: true,
      serviceType: true,
      updatedAt: true,
      receiver: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    shipments: shipments.map((s) => ({
      id: s.id,
      trackingNumber: s.trackingNumber,
      destination: s.destination,
      origin: s.origin,
      status: s.status,
      serviceType: s.serviceType,
      receiverName: s.receiver?.name || null,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}
