import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'SUPERVISOR'];

export async function GET() {
  const { error } = await guard(...MANAGE);
  if (error) return error;

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
}