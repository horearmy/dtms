import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

function ownerCheck(region: { tenantId: string } | null, sessionTenantId: string | null, role: string) {
  if (!region) return NextResponse.json({ error: 'Region tidak ditemukan' }, { status: 404 });
  if (role !== 'SUPER_ADMIN' && region.tenantId !== sessionTenantId) {
    return NextResponse.json({ error: 'Region tidak ditemukan' }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.REGION.READ);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const region = await prisma.region.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        branches: { include: { _count: { select: { users: true, warehouses: true, hubs: true } } } },
        _count: { select: { branches: true } },
      },
    });
    const denied = ownerCheck(region, session.tenantId, session.role);
    if (denied) return denied;
    return NextResponse.json(region);
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.REGION.UPDATE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const region = await prisma.region.findUnique({ where: { id } });
    const denied = ownerCheck(region, session.tenantId, session.role);
    if (denied) return denied;

    const body = await req.json();

    if (body.organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: body.organizationId } });
      if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).slice(0, 100);
    if (body.code !== undefined) data.code = body.code ? String(body.code).slice(0, 20) : null;
    if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 500) : null;
    if (body.organizationId !== undefined) data.organizationId = body.organizationId || null;
    if (body.latitude !== undefined) data.latitude = body.latitude ? Number(body.latitude) : null;
    if (body.longitude !== undefined) data.longitude = body.longitude ? Number(body.longitude) : null;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    const updated = await prisma.region.update({
      where: { id },
      data,
      include: { organization: { select: { id: true, name: true, code: true } } },
    });
    await logAudit(session, 'UPDATE_REGION', 'REGION', { oldData: { id: region!.id, name: region!.name }, newData: { id: updated.id, name: updated.name } }, req);
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.REGION.DELETE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const region = await prisma.region.findUnique({ where: { id } });
    const denied = ownerCheck(region, session.tenantId, session.role);
    if (denied) return denied;

    const hasBranches = await prisma.branch.count({ where: { regionId: id } });
    if (hasBranches > 0) {
      return NextResponse.json({ error: 'Tidak bisa menghapus region yang masih memiliki branch' }, { status: 409 });
    }

    await prisma.region.delete({ where: { id } });
    await logAudit(session, 'DELETE_REGION', 'REGION', { oldData: { id: region!.id, name: region!.name } }, req);
    return NextResponse.json({ ok: true, message: 'Region berhasil dihapus' });
  });
}
