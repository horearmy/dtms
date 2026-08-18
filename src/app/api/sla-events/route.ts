import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { evaluateSlaStatus } from '@/lib/sla';

export async function GET(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.SLA.READ);
  if (error) return error;

  const status = req.nextUrl.searchParams.get('status') || '';
  const where: Record<string, unknown> = {};
  if (session?.tenantId) where.tenantId = session.tenantId;
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
}

export async function POST() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.SLA.CREATE);
  if (error) return error;

  if (!session?.tenantId) {
    return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 400 });
  }

  await evaluateSlaStatus(session.tenantId);
  return NextResponse.json({ ok: true, message: 'SLA evaluation selesai' });
}
