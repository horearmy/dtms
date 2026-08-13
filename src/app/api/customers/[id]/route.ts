import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'CUSTOMER_SERVICE');
  if (error) return error;
  const body = await req.json();
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address,
        city: body.city,
        postalCode: body.postalCode,
        latitude: toNum(body.latitude),
        longitude: toNum(body.longitude),
      },
    });
    await logAudit(session, 'UPDATE_CUSTOMER', 'CUSTOMER', customer.name);
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  try {
    await prisma.customer.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'Tidak dapat menghapus (mungkin dipakai shipment)' }, { status: 400 });
  }
  await logAudit(session, 'DELETE_CUSTOMER', 'CUSTOMER', id);
  return NextResponse.json({ ok: true });
}