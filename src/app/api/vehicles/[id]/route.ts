import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
  const body = await req.json();
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        vehicleNumber: body.vehicleNumber,
        type: body.type,
        capacity: body.capacity != null ? Number(body.capacity) : undefined,
        status: body.status,
        photoFront: body.photoFront || null,
        photoBack: body.photoBack || null,
        photoRight: body.photoRight || null,
        photoLeft: body.photoLeft || null,
      },
    });
    await logAudit(session, 'UPDATE_VEHICLE', 'VEHICLE', vehicle.vehicleNumber);
    return NextResponse.json(vehicle);
  } catch {
    return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  try {
    await prisma.vehicle.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'Tidak dapat menghapus kendaraan' }, { status: 400 });
  }
  await logAudit(session, 'DELETE_VEHICLE', 'VEHICLE', id);
  return NextResponse.json({ ok: true });
}