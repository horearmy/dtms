import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.NOTIFICATION.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    if (session!.role === 'DRIVER') {
      await prisma.notification.updateMany({
        where: { OR: [{ shipment: { assignments: { some: { driver: { userId: session!.id } } } } }, { userId: session!.id }], status: 'UNREAD' },
        data: { status: 'READ' },
      });
    } else {
      // Scope to current tenant via shipment relation
      const tenantFilter = session?.tenantId
        ? { OR: [
            { shipment: { tenantId: session.tenantId } },
            { userId: { not: null } },
          ] }
        : {};
      await prisma.notification.updateMany({ where: { ...tenantFilter, status: 'UNREAD' }, data: { status: 'READ' } });
    }

    await logAudit(session, 'READ_NOTIFICATIONS', 'NOTIFICATION', undefined, req);

    return NextResponse.json({ ok: true });
  });
}
