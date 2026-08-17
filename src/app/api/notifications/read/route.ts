import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, runWithTenant } from '@/lib/api-guard';

export async function POST() {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR', 'MANAGEMENT', 'DRIVER');
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    if (session!.role === 'DRIVER') {
      await prisma.notification.updateMany({
        where: { OR: [{ shipment: { assignments: { some: { driver: { userId: session!.id } } } } }, { userId: session!.id }], status: 'UNREAD' },
        data: { status: 'READ' },
      });
    } else {
      await prisma.notification.updateMany({ where: { status: 'UNREAD' }, data: { status: 'READ' } });
    }
    return NextResponse.json({ ok: true });
  });
}