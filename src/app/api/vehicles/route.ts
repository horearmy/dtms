import { NextRequest, NextResponse } from 'next/server';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { ON_ROAD_STATUSES } from '@/lib/constants';

export async function GET() {
  const { error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR');
  if (error) return error;
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { vehicleNumber: 'asc' },
    include: { _count: { select: { assignments: true } } },
  });
  const result = [];
  for (const v of vehicles) {
    const trip = await prisma.deliveryAssignment.findFirst({
      where: { vehicleId: v.id, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
      select: { shipment: { select: { trackingNumber: true } } },
    });
    result.push({ ...v, busy: !!trip, activeTracking: trip?.shipment.trackingNumber || null });
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
  const body = await req.json();
  if (!body.vehicleNumber || !body.type) {
    return NextResponse.json({ error: 'Nomor kendaraan dan jenis wajib diisi' }, { status: 400 });
  }
  if (!body.photoFront || !body.photoBack || !body.photoRight || !body.photoLeft) {
    return NextResponse.json({ error: 'Foto kendaraan (depan, belakang, samping kanan & kiri) wajib diisi' }, { status: 400 });
  }
  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleNumber: body.vehicleNumber,
        type: body.type,
        capacity: Number(body.capacity) || 0,
        status: body.status || 'AVAILABLE',
        photoFront: body.photoFront || null,
        photoBack: body.photoBack || null,
        photoRight: body.photoRight || null,
        photoLeft: body.photoLeft || null,
      },
    });
    await logAudit(session, 'CREATE_VEHICLE', 'VEHICLE', vehicle.vehicleNumber);
    return NextResponse.json(vehicle, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Nomor kendaraan sudah terdaftar' }, { status: 400 });
  }
}