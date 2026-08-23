import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const { assignmentId } = await params;

    const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

    const assignment = await prisma.deliveryAssignment.findFirst({
      where: { id: assignmentId, driverId: driver.id },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            origin: true,
            destination: true,
            weight: true,
            sender: { select: { name: true, phone: true } },
            receiver: { select: { name: true, phone: true, address: true, city: true } },
            events: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, status: true, notes: true, createdAt: true },
            },
            pods: {
              orderBy: { deliveredAt: 'desc' },
              take: 1,
              select: { receiverName: true, deliveredAt: true, signature: true, photo: true, notes: true },
            },
          },
        },
        vehicle: { select: { vehicleNumber: true } },
      },
    });

    if (!assignment || !assignment.shipmentId) {
      return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ assignment });
  });
}
