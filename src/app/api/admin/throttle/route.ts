import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission('*');
  if (error) return error;
  return runWithTenant(null, async () => {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        rateLimit: {
          select: {
            apiMaxRequests: true,
            apiWindowMs: true,
            gpsMaxRequests: true,
            gpsWindowMs: true,
            active: true,
            blocked: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(tenants);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission('*');
  if (error) return error;
  return runWithTenant(null, async () => {
    const body = await req.json();
    const { tenantId, apiMaxRequests, gpsMaxRequests, active, blocked } = body;
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId wajib diisi' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (apiMaxRequests !== undefined) data.apiMaxRequests = Math.max(1, Math.min(10000, Number(apiMaxRequests)));
    if (gpsMaxRequests !== undefined) data.gpsMaxRequests = Math.max(1, Math.min(10000, Number(gpsMaxRequests)));
    if (active !== undefined) data.active = Boolean(active);
    if (blocked !== undefined) data.blocked = Boolean(blocked);

    const rateLimit = await prisma.tenantRateLimit.upsert({
      where: { tenantId },
      update: data,
      create: {
        tenantId,
        apiMaxRequests: data.apiMaxRequests as number ?? 300,
        gpsMaxRequests: data.gpsMaxRequests as number ?? 60,
        active: data.active as boolean ?? true,
        blocked: data.blocked as boolean ?? false,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.id,
        action: 'TENANT_THROTTLE_UPDATE',
        module: 'admin-throttle',
        newData: JSON.stringify({ tenantId, ...data }),
      },
    });

    return NextResponse.json(rateLimit);
  });
}
