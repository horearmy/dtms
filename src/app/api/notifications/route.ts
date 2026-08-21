import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.NOTIFICATION.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    let items;
    let unread;

    if (session!.role === 'DRIVER') {
      const driverFilter = { OR: [{ shipment: { assignments: { some: { driver: { userId: session!.id } } } } }, { userId: session!.id }] };
      items = await prisma.notification.findMany({
        where: driverFilter,
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      unread = await prisma.notification.count({
        where: { ...driverFilter, status: 'UNREAD' },
      });
    } else {
      // Scope notifications to current tenant via shipment relation
      const tenantFilter = session?.tenantId
        ? { OR: [
            { shipment: { tenantId: session.tenantId } },
            { userId: session!.id },
          ] }
        : { userId: session!.id };
      items = await prisma.notification.findMany({
        where: tenantFilter,
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      unread = await prisma.notification.count({
        where: { ...tenantFilter, status: 'UNREAD' },
      });
    }

    return NextResponse.json({ items, unread });
  });
}
