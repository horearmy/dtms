import { NextRequest, NextResponse } from 'next/server';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { ON_ROAD_STATUSES } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.VEHICLE.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));

    const total = await prisma.vehicle.count();
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { vehicleNumber: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { assignments: true } } },
    });

    const vehicleIds = vehicles.map(v => v.id);
    const activeTrips = await prisma.deliveryAssignment.findMany({
      where: { vehicleId: { in: vehicleIds }, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
      select: { vehicleId: true, shipment: { select: { trackingNumber: true } } },
    });
    const tripMap = new Map<string, string>();
    for (const t of activeTrips) if (t.vehicleId) tripMap.set(t.vehicleId, t.shipment.trackingNumber);

    const result = vehicles.map(v => ({
      ...v,
      busy: !!tripMap.get(v.id || '') || v.returning,
      activeTracking: tripMap.get(v.id || '') || null,
    }));
    return NextResponse.json({ items: result, total, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.VEHICLE.CREATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
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
      await logAudit(session, 'CREATE_VEHICLE', 'VEHICLE', { newData: vehicle }, req);
      return NextResponse.json(vehicle, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Nomor kendaraan sudah terdaftar' }, { status: 400 });
    }
  });
}