import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

function ownerCheck(hub: { tenantId: string } | null, sessionTenantId: string | null, role: string) {
  if (!hub) return NextResponse.json({ error: 'Hub tidak ditemukan' }, { status: 404 });
  if (role !== 'SUPER_ADMIN' && hub.tenantId !== sessionTenantId) {
    return NextResponse.json({ error: 'Hub tidak ditemukan' }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.HUB.READ);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const hub = await prisma.hub.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
    const denied = ownerCheck(hub, session.tenantId, session.role);
    if (denied) return denied;
    return NextResponse.json(hub);
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.HUB.UPDATE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const hub = await prisma.hub.findUnique({ where: { id } });
    const denied = ownerCheck(hub, session.tenantId, session.role);
    if (denied) return denied;

    const body = await req.json();

    if (body.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId } });
      if (!branch) return NextResponse.json({ error: 'Branch tidak ditemukan' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).slice(0, 100);
    if (body.code !== undefined) data.code = body.code ? String(body.code).slice(0, 20) : null;
    if (body.address !== undefined) data.address = body.address ? String(body.address).slice(0, 500) : null;
    if (body.city !== undefined) data.city = body.city ? String(body.city).slice(0, 100) : null;
    if (body.latitude !== undefined) data.latitude = body.latitude ? Number(body.latitude) : null;
    if (body.longitude !== undefined) data.longitude = body.longitude ? Number(body.longitude) : null;
    if (body.radiusMeters !== undefined) data.radiusMeters = Number(body.radiusMeters) || 500;
    if (body.branchId !== undefined) data.branchId = body.branchId;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
    }

    const updated = await prisma.hub.update({ where: { id }, data, include: {
      branch: { select: { id: true, name: true } },
    }});
    await logAudit(session, 'UPDATE_HUB', 'HUB', { oldData: { id: hub!.id, name: hub!.name }, newData: { id: updated.id, name: updated.name } }, req);
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.HUB.DELETE);
  if (error) return error;

  return runWithTenant(session.tenantId ?? null, async () => {
    const hub = await prisma.hub.findUnique({ where: { id } });
    const denied = ownerCheck(hub, session.tenantId, session.role);
    if (denied) return denied;

    await prisma.hub.delete({ where: { id } });
    await logAudit(session, 'DELETE_HUB', 'HUB', { oldData: { id: hub!.id, name: hub!.name } }, req);
    return NextResponse.json({ ok: true, message: 'Hub berhasil dihapus' });
  });
}
