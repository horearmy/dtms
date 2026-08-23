import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ORGANIZATION.READ);
  if (error) return error;

  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  }

  if (session.role !== 'SUPER_ADMIN' && session.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  return runWithTenant(tenantId, async () => {
    const [tenant, organizations, regions, branches, departments, hubs] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, plan: true, status: true },
      }),
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { regions: true, branches: true } },
        },
      }),
      prisma.region.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true } },
          _count: { select: { branches: true } },
        },
      }),
      prisma.branch.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true } },
          region: { select: { id: true, name: true } },
          _count: { select: { users: true, warehouses: true, hubs: true } },
        },
      }),
      prisma.department.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
        },
      }),
      prisma.hub.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      tenant,
      organizations,
      regions,
      branches,
      departments,
      hubs,
    });
  });
}
