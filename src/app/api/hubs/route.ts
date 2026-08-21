import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, guardPlanLimit, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.HUB.READ);
  if (error) return error;

  const paramTenantId = req.nextUrl.searchParams.get('tenantId');
  const tenantId = session.role === 'SUPER_ADMIN' && paramTenantId ? paramTenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });

  const branchId = req.nextUrl.searchParams.get('branchId');
  const search = req.nextUrl.searchParams.get('q') || '';

  return runWithTenant(tenantId, async () => {
    const where: Record<string, unknown> = {};
    if (branchId) where.branchId = branchId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const hubs = await prisma.hub.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(hubs);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.HUB.CREATE);
  if (error) return error;

  const limitError = await guardPlanLimit(session, 'hubs');
  if (limitError) return limitError;

  const body = await req.json();
  const tenantId = session.role === 'SUPER_ADMIN' && body.tenantId ? body.tenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
  if (!body.branchId) return NextResponse.json({ error: 'Branch wajib diisi' }, { status: 400 });

  return runWithTenant(tenantId, async () => {
    if (body.code) {
      const existing = await prisma.hub.findFirst({ where: { tenantId, code: body.code } });
      if (existing) return NextResponse.json({ error: 'Kode hub sudah digunakan' }, { status: 409 });
    }

    const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
    if (!branch) return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 });

    const hub = await prisma.hub.create({
      data: {
        tenantId,
        branchId: body.branchId,
        name: String(body.name).slice(0, 100),
        code: body.code ? String(body.code).slice(0, 20) : null,
        address: body.address ? String(body.address).slice(0, 500) : null,
        city: body.city ? String(body.city).slice(0, 100) : null,
        latitude: body.latitude ? Number(body.latitude) : null,
        longitude: body.longitude ? Number(body.longitude) : null,
        radiusMeters: body.radiusMeters ? Number(body.radiusMeters) : 500,
        active: body.active !== false,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    await logAudit(session, 'CREATE_HUB', 'HUB', { newData: { id: hub.id, name: hub.name } }, req);
    return NextResponse.json(hub, { status: 201 });
  });
}
