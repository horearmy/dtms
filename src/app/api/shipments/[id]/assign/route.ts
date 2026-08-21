import { NextRequest, NextResponse } from 'next/server';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { ON_ROAD_STATUSES } from '@/lib/constants';
import { sendTextMessage, isWhatsAppEnabled } from '@/lib/whatsapp';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.SHIPMENT.ASSIGN);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { driverId, vehicleId } = body || {};
    if (!driverId) return NextResponse.json({ error: 'Driver wajib dipilih' }, { status: 400 });
    if (!vehicleId) return NextResponse.json({ error: 'Kendaraan wajib dipilih' }, { status: 400 });

    const shipment = await prisma.shipment.findUnique({ where: { id }, include: { assignments: true } });
    if (!shipment) return NextResponse.json({ error: 'Shipment tidak ditemukan' }, { status: 404 });

    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) return NextResponse.json({ error: 'Kendaraan tidak ditemukan' }, { status: 404 });
      if (vehicle.status === 'MAINTENANCE') {
        return NextResponse.json(
          { error: `Kendaraan ${vehicle.vehicleNumber} sedang MAINTENANCE (jarak ${Math.round(vehicle.totalDistanceKm)} km) dan tidak dapat digunakan` },
          { status: 400 }
        );
      }
      const activeTrip = await prisma.deliveryAssignment.findFirst({
        where: {
          vehicleId,
          shipmentId: { not: id },
          shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } },
        },
        select: { shipment: { select: { trackingNumber: true } } },
      });
      if (activeTrip) {
        return NextResponse.json(
          {
            error: `Kendaraan ${vehicle.vehicleNumber} sedang digunakan untuk resi ${activeTrip.shipment.trackingNumber} (belum kembali). Pilih kendaraan lain.`,
          },
          { status: 400 }
        );
      }
      if (vehicle.returning) {
        return NextResponse.json(
          { error: `Kendaraan ${vehicle.vehicleNumber} sedang kembali ke gudang. Pilih kendaraan lain.` },
          { status: 400 }
        );
      }
    }

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });

    const activeTrip = await prisma.deliveryAssignment.findFirst({
      where: {
        driverId,
        shipmentId: { not: id },
        shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } },
      },
      select: { shipment: { select: { trackingNumber: true } } },
    });
    if (activeTrip) {
      return NextResponse.json(
        {
          error: `Driver ${driver.name} masih dalam perjalanan (resi ${activeTrip.shipment.trackingNumber}) dan belum kembali. Pilih driver lain.`,
        },
        { status: 400 }
      );
    }
    if (driver.returning) {
      return NextResponse.json(
        { error: `Driver ${driver.name} sedang kembali ke gudang. Pilih driver lain.` },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryAssignment.deleteMany({ where: { shipmentId: id } });
      await tx.deliveryAssignment.create({
        data: { shipmentId: id, driverId, vehicleId: vehicleId || null },
      });
    });

    const assignment = await prisma.deliveryAssignment.findFirst({ where: { shipmentId: id, driverId } });

    if (isWhatsAppEnabled() && driver.phone) {
      try {
        await sendTextMessage(
          driver.phone,
          `Anda ditugaskan untuk pengiriman resi *${shipment.trackingNumber}*\n` +
          `Tujuan: ${shipment.destination}\n\n` +
          `Silakan persiapkan diri untuk pengiriman.`
        );
      } catch {
        // WhatsApp failure is non-critical
      }
    }

    await logAudit(session, 'ASSIGN_DRIVER', 'SHIPMENT', { newData: { trackingNumber: shipment.trackingNumber, driverId, vehicleId: vehicleId || null } }, req);
    return NextResponse.json({ assignment }, { status: 201 });
  });
}