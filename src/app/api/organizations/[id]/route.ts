import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

function ownerCheck(org: { tenantId: string } | null, sessionTenantId: string | null, role: string) {
  if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
  if (role !== 'SUPER_ADMIN' && org.tenantId !== sessionTenantId) {
    return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.ORGANIZATION.READ);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        regions: { include: { _count: { select: { branches: true } } } },
        branches: { include: { _count: { select: { users: true, warehouses: true, hubs: true } } } },
        _count: { select: { regions: true, branches: true } },
      },
    });
    const denied = ownerCheck(org, session.tenantId, session.role);
    if (denied) return denied;
    return NextResponse.json(org);
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.ORGANIZATION.UPDATE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const org = await prisma.organization.findUnique({ where: { id } });
    const denied = ownerCheck(org, session.tenantId, session.role);
    if (denied) return denied;

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).slice(0, 100);
    if (body.code !== undefined) data.code = body.code ? String(body.code).slice(0, 20) : null;
    if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 500) : null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    const updated = await prisma.organization.update({ where: { id }, data });
    await logAudit(session, 'UPDATE_ORGANIZATION', 'ORGANIZATION', { oldData: { id: org!.id, name: org!.name }, newData: { id: updated.id, name: updated.name } }, req);
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.ORGANIZATION.DELETE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const org = await prisma.organization.findUnique({ where: { id } });
    const denied = ownerCheck(org, session.tenantId, session.role);
    if (denied) return denied;

    const [hasBranches, hasRegions] = await Promise.all([
      prisma.branch.count({ where: { organizationId: id } }),
      prisma.region.count({ where: { organizationId: id } }),
    ]);
    if (hasBranches > 0 || hasRegions > 0) {
      return NextResponse.json({ error: 'Tidak bisa menghapus organization yang masih memiliki branch atau region' }, { status: 409 });
    }

    await prisma.organization.delete({ where: { id } });
    await logAudit(session, 'DELETE_ORGANIZATION', 'ORGANIZATION', { oldData: { id: org!.id, name: org!.name } }, req);
    return NextResponse.json({ ok: true, message: 'Organization berhasil dihapus' });
  });
}
