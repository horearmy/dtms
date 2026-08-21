import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, guardPlanLimit, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.BRANCH.READ);
  if (error) return error;

  const paramTenantId = req.nextUrl.searchParams.get('tenantId');
  const tenantId = session.role === 'SUPER_ADMIN' && paramTenantId ? paramTenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });

  const orgId = req.nextUrl.searchParams.get('organizationId');
  const regionId = req.nextUrl.searchParams.get('regionId');
  const search = req.nextUrl.searchParams.get('q') || '';

  return runWithTenant(tenantId, async () => {
    const where: Record<string, unknown> = {};
    if (orgId) where.organizationId = orgId;
    if (regionId) where.regionId = regionId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const branches = await prisma.branch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        _count: { select: { users: true, warehouses: true, hubs: true } },
      },
    });
    return NextResponse.json(branches);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.BRANCH.CREATE);
  if (error) return error;

  const limitError = await guardPlanLimit(session, 'branches');
  if (limitError) return limitError;

  const body = await req.json();
  const tenantId = session.role === 'SUPER_ADMIN' && body.tenantId ? body.tenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

  return runWithTenant(tenantId, async () => {
    if (body.code) {
      const existing = await prisma.branch.findFirst({ where: { code: body.code } });
      if (existing) return NextResponse.json({ error: 'Kode branch sudah digunakan' }, { status: 409 });
    }

    if (body.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: body.organizationId } });
      if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
    }
    if (body.regionId) {
      const region = await prisma.region.findUnique({ where: { id: body.regionId } });
      if (!region) return NextResponse.json({ error: 'Region tidak ditemukan' }, { status: 404 });
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId,
        organizationId: body.organizationId || null,
        regionId: body.regionId || null,
        name: String(body.name).slice(0, 100),
        code: body.code ? String(body.code).slice(0, 20) : null,
        address: body.address ? String(body.address).slice(0, 500) : null,
        city: body.city ? String(body.city).slice(0, 100) : null,
        postalCode: body.postalCode ? String(body.postalCode).slice(0, 10) : null,
        phone: body.phone ? String(body.phone).slice(0, 20) : null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        active: body.active !== false,
      },
      include: {
        organization: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
      },
    });

    await logAudit(session, 'CREATE_BRANCH', 'BRANCH', { newData: { id: branch.id, name: branch.name } }, req);
    return NextResponse.json(branch, { status: 201 });
  });
}
