import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { evaluateSlaStatus } from '@/lib/sla';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.SLA.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const status = req.nextUrl.searchParams.get('status') || '';
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const events = await prisma.slaEvent.findMany({
      where,
      include: {
        shipment: { select: { id: true, trackingNumber: true, destination: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(events);
  });
}

export async function POST() {
  const { session, error } = await guardPermission(PERMISSIONS.SLA.CREATE);
  if (error) return error;

  if (!session?.tenantId) {
    return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 400 });
  }

  await evaluateSlaStatus(session.tenantId);
  return NextResponse.json({ ok: true, message: 'SLA evaluation selesai' });
}
