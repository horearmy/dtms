import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) return NextResponse.json({ error: 'Gudang tidak ditemukan' }, { status: 404 });
    return NextResponse.json(warehouse);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.UPDATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    try {
      const before = await prisma.warehouse.findUnique({ where: { id }, select: { id: true, name: true, code: true, active: true } });
      const warehouse = await prisma.warehouse.update({
        where: { id },
        data: {
          name: body.name,
          code: body.code,
          address: body.address,
          city: body.city,
          latitude: body.latitude != null ? Number(body.latitude) : undefined,
          longitude: body.longitude != null ? Number(body.longitude) : undefined,
          radiusMeters: body.radiusMeters != null ? Number(body.radiusMeters) : undefined,
          active: body.active,
        },
      });
      await logAudit(session, 'UPDATE_WAREHOUSE', 'WAREHOUSE', { oldData: before, newData: { id: warehouse.id, name: warehouse.name, code: warehouse.code, active: warehouse.active } }, req);
      return NextResponse.json(warehouse);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Kode gudang sudah digunakan' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Gudang tidak ditemukan' }, { status: 404 });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.DELETE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    try {
      const before = await prisma.warehouse.findUnique({ where: { id } });
      await prisma.warehouse.delete({ where: { id } });
      await logAudit(session, 'DELETE_WAREHOUSE', 'WAREHOUSE', { oldData: before }, req);
    } catch {
      return NextResponse.json({ error: 'Tidak dapat menghapus gudang' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  });
}
