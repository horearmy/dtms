import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

const VIEW = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR', 'MANAGEMENT'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await guard(...VIEW);
  if (error) return error;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      sender: true,
      receiver: true,
      items: true,
      assignments: {
        include: {
          driver: { include: { gpsLogs: { orderBy: { createdAt: 'desc' }, take: 1 } } },
          vehicle: true,
        },
      },
      events: { orderBy: { createdAt: 'asc' } },
      pods: true,
      stops: { orderBy: { seq: 'asc' } },
    },
  });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });
  return NextResponse.json(shipment);
}