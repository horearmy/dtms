import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, runWithTenant } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR', 'MANAGEMENT', 'DRIVER');
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const where = session!.role === 'DRIVER' ? { userId: session!.id } : {};
    const items = await prisma.notification.findMany({
      where: session!.role === 'DRIVER' ? { OR: [{ shipment: { assignments: { some: { driver: { userId: session!.id } } } } }, { userId: session!.id }] } : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const unread = await prisma.notification.count({
      where: session!.role === 'DRIVER'
        ? { OR: [{ shipment: { assignments: { some: { driver: { userId: session!.id } } } } }, { userId: session!.id }], status: 'UNREAD' }
        : { status: 'UNREAD' },
    });

    return NextResponse.json({ items, unread });
  });
}