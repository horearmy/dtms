import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.NOTIFICATION.READ);
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