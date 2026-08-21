import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DEPARTMENT.READ);
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
      ];
    }

    const departments = await prisma.department.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(departments);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DEPARTMENT.CREATE);
  if (error) return error;

  const body = await req.json();
  const tenantId = session.role === 'SUPER_ADMIN' && body.tenantId ? body.tenantId : session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

  return runWithTenant(tenantId, async () => {
    if (body.code) {
      const existing = await prisma.department.findFirst({ where: { tenantId, code: body.code } });
      if (existing) return NextResponse.json({ error: 'Kode departemen sudah digunakan' }, { status: 409 });
    }

    if (body.companyId) {
      const company = await prisma.company.findUnique({ where: { id: body.companyId } });
      if (!company) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
    }
    if (body.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
      if (!branch) return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 });
    }

    const department = await prisma.department.create({
      data: {
        tenantId,
        companyId: body.companyId || null,
        branchId: body.branchId || null,
        name: String(body.name).slice(0, 100),
        code: body.code ? String(body.code).slice(0, 20) : null,
        active: body.active !== false,
      },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    await logAudit(session, 'CREATE_DEPARTMENT', 'DEPARTMENT', { newData: { id: department.id, name: department.name } }, req);
    return NextResponse.json(department, { status: 201 });
  });
}
