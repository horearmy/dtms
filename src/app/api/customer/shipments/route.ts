import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  // Find customer linked to this user
  const customer = await prisma.customer.findFirst({
    where: { userId: session?.id },
  });

  if (!customer) {
    return NextResponse.json({ shipments: [] });
  }

  const shipments = await prisma.shipment.findMany({
    where: { customerId: customer.id },
    select: {
      id: true,
      trackingNumber: true,
      destination: true,
      originAddress: true,
      status: true,
      serviceType: true,
      updatedAt: true,
      receiverName: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    shipments: shipments.map((s) => ({
      ...s,
      origin: s.originAddress,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}
