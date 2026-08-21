import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, guardPlanLimit, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ORGANIZATION.READ);
  if (error) return error;

  const paramTenantId = req.nextUrl.searchParams.get('tenantId');
  const tenantId = session.role === 'SUPER_ADMIN' && paramTenantId ? paramTenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });

  return runWithTenant(tenantId, async () => {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { regions: true, branches: true } },
      },
    });
    return NextResponse.json(orgs);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ORGANIZATION.CREATE);
  if (error) return error;

  const limitError = await guardPlanLimit(session, 'organizations');
  if (limitError) return limitError;

  const body = await req.json();
  const tenantId = session.role === 'SUPER_ADMIN' && body.tenantId ? body.tenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

  return runWithTenant(tenantId, async () => {
    if (body.code) {
      const existing = await prisma.organization.findFirst({ where: { code: body.code } });
      if (existing) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 409 });
    }

    const org = await prisma.organization.create({
      data: {
        tenantId,
        name: String(body.name).slice(0, 100),
        code: body.code ? String(body.code).slice(0, 20) : null,
        description: body.description ? String(body.description).slice(0, 500) : null,
        logoUrl: body.logoUrl || null,
        active: body.active !== false,
      },
    });

    await logAudit(session, 'CREATE_ORGANIZATION', 'ORGANIZATION', { newData: { id: org.id, name: org.name } }, req);
    return NextResponse.json(org, { status: 201 });
  });
}
