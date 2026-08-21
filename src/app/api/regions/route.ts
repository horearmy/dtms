import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.REGION.READ);
  if (error) return error;

  const paramTenantId = req.nextUrl.searchParams.get('tenantId');
  const tenantId = session.role === 'SUPER_ADMIN' && paramTenantId ? paramTenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });

  const orgId = req.nextUrl.searchParams.get('organizationId');

  return runWithTenant(tenantId, async () => {
    const where: Record<string, unknown> = {};
    if (orgId) where.organizationId = orgId;

    const regions = await prisma.region.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        _count: { select: { branches: true } },
      },
    });
    return NextResponse.json(regions);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.REGION.CREATE);
  if (error) return error;

  const body = await req.json();
  const tenantId = session.role === 'SUPER_ADMIN' && body.tenantId ? body.tenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

  return runWithTenant(tenantId, async () => {
    if (body.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: body.organizationId } });
      if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
    }

    if (body.code) {
      const existing = await prisma.region.findFirst({ where: { code: body.code } });
      if (existing) return NextResponse.json({ error: 'Kode region sudah digunakan' }, { status: 409 });
    }

    const region = await prisma.region.create({
      data: {
        tenantId,
        organizationId: body.organizationId || null,
        name: String(body.name).slice(0, 100),
        code: body.code ? String(body.code).slice(0, 20) : null,
        description: body.description ? String(body.description).slice(0, 500) : null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        active: body.active !== false,
      },
      include: { organization: { select: { id: true, name: true, code: true } } },
    });

    await logAudit(session, 'CREATE_REGION', 'REGION', { newData: { id: region.id, name: region.name } }, req);
    return NextResponse.json(region, { status: 201 });
  });
}
