import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard('DRIVER', 'SUPER_ADMIN', 'DISPATCHER', 'ADMIN_OPERASIONAL', 'SUPERVISOR');
  if (error) return error;

  const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
  if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

  const assignments = await prisma.deliveryAssignment.findMany({
    where: { driverId: driver.id },
    orderBy: { assignedAt: 'desc' },
    include: {
      shipment: {
        include: {
          sender: true,
          receiver: true,
          pods: true,
          events: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      vehicle: true,
    },
  });

  return NextResponse.json({ assignments });
}