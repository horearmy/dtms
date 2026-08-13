import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
  const body = await req.json();
  try {
    const driver = await prisma.driver.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        status: body.status,
      },
    });
    await logAudit(session, 'UPDATE_DRIVER', 'DRIVER', driver.name);
    return NextResponse.json(driver);
  } catch {
    return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  try {
    await prisma.driver.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'Tidak dapat menghapus driver' }, { status: 400 });
  }
  await logAudit(session, 'DELETE_DRIVER', 'DRIVER', id);
  return NextResponse.json({ ok: true });
}