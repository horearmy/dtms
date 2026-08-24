import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { runWithTenant } from '@/lib/api-guard';
import { createSubscription, validatePlanChange } from '@/lib/billing';

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
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const isTenantAdmin = session.role === 'ADMIN_OPERASIONAL' && session.tenantId === id;

  if (!isSuperAdmin && !isTenantAdmin) {
    return NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 });
  }

  const body = await req.json();

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  const PROFILE_FIELDS = ['name', 'contactName', 'contactEmail', 'contactPhone', 'logoUrl', 'faviconUrl', 'primaryColor', 'secondaryColor', 'accentColor', 'domain', 'timezone', 'locale', 'currency'];
  const ADMIN_ONLY_FIELDS = ['status', 'active', 'plan', 'maxUsers', 'maxDrivers', 'maxShipments'];

  const data: Record<string, unknown> = {};
  for (const f of PROFILE_FIELDS) {
    if (body[f] !== undefined) {
      if (f === 'name') data[f] = String(body[f]).slice(0, 100);
      else data[f] = body[f] || null;
    }
  }

  if (isSuperAdmin) {
    for (const f of ADMIN_ONLY_FIELDS) {
      if (body[f] !== undefined) {
        if (f === 'maxUsers' || f === 'maxDrivers' || f === 'maxShipments') {
          const n = Number(body[f]);
          if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: `${f} harus angka >= 1` }, { status: 400 });
          data[f] = n;
        }
        else if (f === 'active') data[f] = body[f];
        else data[f] = body[f];
      }
    }
  }

  if (Object.keys(data).length === 0 && body.plan === undefined) {
    return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
  }

  // If plan changed, use createSubscription to sync both Tenant.plan AND Subscription
  if (body.plan !== undefined && body.plan !== tenant.plan) {
    const blocked = await validatePlanChange(id, String(body.plan));
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    await createSubscription(id, String(body.plan), body.billingCycle || 'MONTHLY');
  }

  // Remove plan from data since createSubscription already sets it
  delete data.plan;
  delete data.billingCycle;

  if (Object.keys(data).length > 0) {
    await prisma.tenant.update({ where: { id }, data });
  }

  const updated = await prisma.tenant.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
  if (!updated) return NextResponse.json({ error: 'Gagal memperbarui tenant' }, { status: 500 });

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
