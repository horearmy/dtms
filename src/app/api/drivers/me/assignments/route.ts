import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const driver = await prisma.driver.findFirst({
    where: { userId: session.id },
    select: { id: true },
  });

  if (!driver) {
    return NextResponse.json([]);
  }

  const assignments = await prisma.deliveryAssignment.findMany({
    where: { driverId: driver.id },
    orderBy: { assignedAt: 'desc' },
    take: 20,
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          status: true,
          origin: true,
          destination: true,
          sender: { select: { name: true, phone: true, address: true, city: true } },
          receiver: { select: { name: true, phone: true, address: true, city: true } },
        },
      },
    },
  });

  return NextResponse.json(assignments);
}
