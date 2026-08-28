import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findFirst({
      where: { userId: session?.id },
      select: { id: true, name: true },
    });

    if (!driver) {
      return NextResponse.json({ assignments: [], driverName: session?.name || 'Driver' });
    }

    const assignments = await prisma.deliveryAssignment.findMany({
      where: { driverId: driver.id },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            origin: true,
            destination: true,
            weight: true,
            sender: { select: { name: true, phone: true, address: true } },
            receiver: { select: { name: true, phone: true, address: true, city: true } },
            events: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { status: true, createdAt: true },
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
      orderBy: { assignedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ assignments, driverName: driver.name });
  });
}

// Endpoint status diperbarui sentral melalui /api/shipments/{id}/events (guard driver).
// POST legacy dihapus agar hanya ada satu jalur perubahan status agar konsisten.
export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint ini sudah dinonaktifkan. Gunakan /api/shipments/{id}/events untuk pembaruan status.' },
    { status: 410 }
  );
}
