import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.WAREHOUSE.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const scans = await prisma.warehouseScan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { shipment: { select: { trackingNumber: true, destination: true } } },
    });

    return NextResponse.json(
      scans.map((s) => ({
        id: s.id,
        action: s.action,
        scannedBy: s.scannedBy,
        notes: s.notes,
        latitude: s.latitude,
        longitude: s.longitude,
        createdAt: s.createdAt,
        trackingNumber: s.shipment.trackingNumber,
        destination: s.shipment.destination,
      }))
    );
  });
}