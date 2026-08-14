import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function POST(req: NextRequest) {
  const { session, error } = await guard('DRIVER', 'SUPER_ADMIN', 'DISPATCHER', 'ADMIN_OPERASIONAL');
  if (error) return error;

  const body = await req.json();
  const action = body?.action;

  const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
  if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

  if (action === 'start') {
    if (driver.returning) {
      return NextResponse.json({ error: 'Driver sudah dalam status kembali ke gudang' }, { status: 400 });
    }
    const latest = await prisma.deliveryAssignment.findFirst({
      where: { driverId: driver.id },
      orderBy: { assignedAt: 'desc' },
      select: { vehicleId: true },
    });
    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { returning: true, returnedAt: null, returnStartedAt: new Date() },
    });
    if (latest?.vehicleId) {
      await prisma.vehicle.update({
        where: { id: latest.vehicleId },
        data: { returning: true, returnedAt: null },
      });
    }
    await logAudit(session, 'DRIVER_RETURN_START', 'DRIVER', driver.name);
    return NextResponse.json({ driver: updated });
  }

  if (action === 'complete') {
    if (!driver.returning) {
      return NextResponse.json({ error: 'Driver tidak dalam status kembali' }, { status: 400 });
    }
    const now = new Date();
    const latest = await prisma.deliveryAssignment.findFirst({
      where: { driverId: driver.id },
      orderBy: { assignedAt: 'desc' },
      select: { vehicleId: true },
    });
    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { returning: false, returnedAt: now },
    });
    if (latest?.vehicleId) {
      await prisma.vehicle.update({
        where: { id: latest.vehicleId },
        data: { returning: false, returnedAt: now },
      });
    }
    await logAudit(session, 'DRIVER_RETURN_COMPLETE', 'DRIVER', driver.name);
    return NextResponse.json({ driver: updated });
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal (start/complete)' }, { status: 400 });
}
