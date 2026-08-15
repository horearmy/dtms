import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR');
  if (error) return error;
  const body = await req.json();
  if (!body.type) {
    return NextResponse.json({ error: 'Jenis perawatan wajib diisi' }, { status: 400 });
  }
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 });

  try {
    const record = await prisma.vehicleMaintenance.create({
      data: {
        vehicleId: id,
        type: body.type,
        description: body.description || null,
        cost: body.cost != null && body.cost !== '' ? Number(body.cost) : null,
        odometerKm: body.odometerKm != null && body.odometerKm !== '' ? Number(body.odometerKm) : null,
        notes: body.notes || null,
        performedAt: body.performedAt ? new Date(body.performedAt) : new Date(),
      },
    });
    await logAudit(session, 'CREATE_VEHICLE_MAINTENANCE', 'VEHICLE', { newData: record }, req);
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan riwayat perawatan' }, { status: 400 });
  }
}