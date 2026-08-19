import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, scope, error } = await guardPermission(PERMISSIONS.VEHICLE.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        maintenanceRecords: { orderBy: { performedAt: 'desc' } },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            driver: { select: { id: true, name: true, employeeId: true } },
            shipment: {
              select: {
                trackingNumber: true,
                origin: true,
                destination: true,
                originLat: true,
                originLng: true,
                destLat: true,
                destLng: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!vehicle) return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 });
    return NextResponse.json(vehicle);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, scope, error } = await guardPermission(PERMISSIONS.VEHICLE.UPDATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    try {
      const before = await prisma.vehicle.findUnique({ where: { id }, select: { id: true, vehicleNumber: true, type: true, status: true, capacity: true } });
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: {
          vehicleNumber: body.vehicleNumber,
          type: body.type,
          capacity: body.capacity != null ? Number(body.capacity) : undefined,
          status: body.status,
          totalDistanceKm: body.totalDistanceKm != null ? Number(body.totalDistanceKm) : undefined,
          photoFront: body.photoFront || null,
          photoBack: body.photoBack || null,
          photoRight: body.photoRight || null,
          photoLeft: body.photoLeft || null,
        },
      });
      await logAudit(
        session,
        'UPDATE_VEHICLE',
        'VEHICLE',
        { oldData: before, newData: { id: vehicle.id, vehicleNumber: vehicle.vehicleNumber, type: vehicle.type, status: vehicle.status } },
        req
      );
      return NextResponse.json(vehicle);
    } catch {
      return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, scope, error } = await guardPermission(PERMISSIONS.VEHICLE.DELETE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    try {
      const before = await prisma.vehicle.findUnique({ where: { id } });
      await prisma.vehicle.delete({ where: { id } });
      await logAudit(session, 'DELETE_VEHICLE', 'VEHICLE', { oldData: before }, req);
    } catch {
      return NextResponse.json({ error: 'Tidak dapat menghapus kendaraan' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  });
}