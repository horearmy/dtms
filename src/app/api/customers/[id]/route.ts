import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.CUSTOMER.UPDATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    try {
      const before = await prisma.customer.findUnique({ where: { id } });
      const customer = await prisma.customer.update({
        where: { id },
        data: {
          name: body.name,
          phone: body.phone,
          email: body.email,
          address: body.address,
          city: body.city,
          postalCode: body.postalCode,
          latitude: body.latitude != null ? toNum(body.latitude) : undefined,
          longitude: body.longitude != null ? toNum(body.longitude) : undefined,
        },
      });
      await logAudit(
        session,
        'UPDATE_CUSTOMER',
        'CUSTOMER',
        { oldData: before, newData: customer },
        req
      );
      return NextResponse.json(customer);
    } catch {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.CUSTOMER.DELETE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    try {
      const before = await prisma.customer.findUnique({ where: { id } });
      await prisma.customer.delete({ where: { id } });
      await logAudit(session, 'DELETE_CUSTOMER', 'CUSTOMER', { oldData: before }, req);
    } catch {
      return NextResponse.json({ error: 'Tidak dapat menghapus (mungkin dipakai shipment)' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  });
}