import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

function ownerCheck(branch: { tenantId: string } | null, sessionTenantId: string | null, role: string) {
  if (!branch) return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 });
  if (role !== 'SUPER_ADMIN' && branch.tenantId !== sessionTenantId) {
    return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.BRANCH.READ);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        region: { select: { id: true, name: true } },
        users: { select: { id: true, name: true, username: true, role: true, status: true } },
        _count: { select: { users: true, warehouses: true, hubs: true, departments: true } },
      },
    });
    const denied = ownerCheck(branch, session.tenantId, session.role);
    if (denied) return denied;
    return NextResponse.json(branch);
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.BRANCH.UPDATE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const branch = await prisma.branch.findUnique({ where: { id } });
    const denied = ownerCheck(branch, session.tenantId, session.role);
    if (denied) return denied;

    const body = await req.json();

    if (body.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: body.organizationId } });
      if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
    }
    if (body.regionId) {
      const region = await prisma.region.findUnique({ where: { id: body.regionId } });
      if (!region) return NextResponse.json({ error: 'Region tidak ditemukan' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).slice(0, 100);
    if (body.code !== undefined) data.code = body.code ? String(body.code).slice(0, 20) : null;
    if (body.address !== undefined) data.address = body.address ? String(body.address).slice(0, 500) : null;
    if (body.city !== undefined) data.city = body.city ? String(body.city).slice(0, 100) : null;
    if (body.postalCode !== undefined) data.postalCode = body.postalCode ? String(body.postalCode).slice(0, 10) : null;
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).slice(0, 20) : null;
    if (body.latitude !== undefined) data.latitude = body.latitude ? Number(body.latitude) : null;
    if (body.longitude !== undefined) data.longitude = body.longitude ? Number(body.longitude) : null;
    if (body.organizationId !== undefined) data.organizationId = body.organizationId || null;
    if (body.regionId !== undefined) data.regionId = body.regionId || null;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    const updated = await prisma.branch.update({ where: { id }, data, include: {
      organization: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
    }});
    await logAudit(session, 'UPDATE_BRANCH', 'BRANCH', { oldData: { id: branch!.id, name: branch!.name }, newData: { id: updated.id, name: updated.name } }, req);
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.BRANCH.DELETE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const branch = await prisma.branch.findUnique({ where: { id } });
    const denied = ownerCheck(branch, session.tenantId, session.role);
    if (denied) return denied;

    const [hasUsers, hasWarehouses, hasHubs] = await Promise.all([
      prisma.user.count({ where: { branchId: id } }),
      prisma.warehouse.count({ where: { branchId: id } }),
      prisma.hub.count({ where: { branchId: id } }),
    ]);
    if (hasUsers > 0 || hasWarehouses > 0 || hasHubs > 0) {
      return NextResponse.json({ error: 'Tidak bisa menghapus branch yang masih memiliki user, warehouse, atau hub' }, { status: 409 });
    }

    await prisma.branch.delete({ where: { id } });
    await logAudit(session, 'DELETE_BRANCH', 'BRANCH', { oldData: { id: branch!.id, name: branch!.name } }, req);
    return NextResponse.json({ ok: true, message: 'Branch berhasil dihapus' });
  });
}
