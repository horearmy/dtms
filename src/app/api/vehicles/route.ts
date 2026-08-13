import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function GET() {
  const { error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR');
  if (error) return error;
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { vehicleNumber: 'asc' },
    include: { _count: { select: { assignments: true } } },
  });
  return NextResponse.json(vehicles);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
  const body = await req.json();
  if (!body.vehicleNumber || !body.type) {
    return NextResponse.json({ error: 'Nomor kendaraan dan jenis wajib diisi' }, { status: 400 });
  }
  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleNumber: body.vehicleNumber,
        type: body.type,
        capacity: Number(body.capacity) || 0,
        status: body.status || 'AVAILABLE',
      },
    });
    await logAudit(session, 'CREATE_VEHICLE', 'VEHICLE', vehicle.vehicleNumber);
    return NextResponse.json(vehicle, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Nomor kendaraan sudah terdaftar' }, { status: 400 });
  }
}