import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;

  const body = await req.json();
  const { driverId, vehicleId } = body || {};
  if (!driverId) return NextResponse.json({ error: 'Driver wajib dipilih' }, { status: 400 });

  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { assignments: true } });
  if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

  await prisma.deliveryAssignment.deleteMany({ where: { shipmentId: id } });

  const assignment = await prisma.deliveryAssignment.create({
    data: { shipmentId: id, driverId, vehicleId: vehicleId || null },
  });

  if (shipment.status === 'ORDER_CREATED') {
    await prisma.shipment.update({ where: { id }, data: { status: 'PICKUP_SCHEDULED' } });
    await prisma.trackingEvent.create({
      data: { shipmentId: id, status: 'PICKUP_SCHEDULED', createdBy: session?.id, notes: 'Driver ditugaskan' },
    });
  }

  await logAudit(session, 'ASSIGN_DRIVER', 'SHIPMENT', `${shipment.trackingNumber} -> ${driverId}`);
  return NextResponse.json({ assignment }, { status: 201 });
}