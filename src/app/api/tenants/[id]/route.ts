import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { runWithTenant } from '@/lib/api-guard';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, drivers: true, shipments: true, vehicles: true, customers: true, geofences: true } },
      subscription: { include: { plan: true } },
    },
  });

  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).slice(0, 100);
  if (body.status !== undefined) data.status = body.status;
  if (body.active !== undefined) data.active = body.active;
  if (body.plan !== undefined) data.plan = body.plan;
  if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) data.secondaryColor = body.secondaryColor;
  if (body.accentColor !== undefined) data.accentColor = body.accentColor;
  if (body.domain !== undefined) data.domain = body.domain || null;
  if (body.timezone !== undefined) data.timezone = body.timezone;
  if (body.locale !== undefined) data.locale = body.locale;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.contactName !== undefined) data.contactName = body.contactName || null;
  if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail || null;
  if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone || null;
  if (body.maxUsers !== undefined) data.maxUsers = Number(body.maxUsers);
  if (body.maxDrivers !== undefined) data.maxDrivers = Number(body.maxDrivers);
  if (body.maxShipments !== undefined) data.maxShipments = Number(body.maxShipments);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
  }

  const updated = await prisma.tenant.update({ where: { id }, data });

  await logAudit(session, 'UPDATE_TENANT', 'TENANT', {
    oldData: { id: tenant.id, name: tenant.name, status: tenant.status, active: tenant.active, plan: tenant.plan },
    newData: { id: updated.id, name: updated.name, status: updated.status, active: updated.active, plan: updated.plan },
  }, req);

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const action = body.action as string || 'archive';
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  if (action === 'delete') {
    await runWithTenant(tenant.id, async () => {
      await logAudit(session, 'DELETE_TENANT', 'TENANT', {
        oldData: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      }, req);
    });
    await prisma.tenant.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: 'Tenant dan semua data terkait berhasil dihapus permanen' });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { status: 'ARCHIVED', active: false },
  });

  await logAudit(session, 'ARCHIVE_TENANT', 'TENANT', {
    oldData: { id: tenant.id, name: tenant.name, status: tenant.status, active: tenant.active },
    newData: { id: updated.id, status: 'ARCHIVED', active: false },
  }, req);

  return NextResponse.json({ ok: true, message: 'Tenant berhasil diarsipkan', tenant: updated });
}
