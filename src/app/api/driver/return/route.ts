import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DELIVERY.COMPLETE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const action = body?.action;

    const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
    if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

    if (action === 'start') {
      if (driver.returning) {
        return NextResponse.json({ error: 'Driver sudah dalam status kembali ke gudang' }, { status: 400 });
      }
      const latest = await prisma.deliveryAssignment.findFirst({
        where: { driverId: driver.id },
        orderBy: { assignedAt: 'desc' },
        select: { vehicleId: true },
      });
      const updated = await prisma.driver.update({
        where: { id: driver.id },
        data: { returning: true, returnedAt: null, returnStartedAt: new Date() },
      });
      if (latest?.vehicleId) {
        await prisma.vehicle.update({
          where: { id: latest.vehicleId },
          data: { returning: true, returnedAt: null },
        });
      }
      await logAudit(session, 'DRIVER_RETURN_START', 'DRIVER', { newData: { returning: true, at: new Date().toISOString() } }, req);
      return NextResponse.json({ driver: updated });
    }

    if (action === 'complete') {
      if (!driver.returning) {
        return NextResponse.json({ error: 'Driver tidak dalam status kembali' }, { status: 400 });
      }
      const now = new Date();
      const latest = await prisma.deliveryAssignment.findFirst({
        where: { driverId: driver.id },
        orderBy: { assignedAt: 'desc' },
        select: { vehicleId: true },
      });

      const updated = await prisma.driver.update({
        where: { id: driver.id },
        data: { returning: false, returnedAt: now, status: 'ACTIVE' },
      });

      if (latest?.vehicleId) {
        await prisma.vehicle.update({
          where: { id: latest.vehicleId },
          data: { returning: false, returnedAt: now, status: 'AVAILABLE' },
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayDelivered = await prisma.deliveryAssignment.count({
        where: {
          driverId: driver.id,
          shipment: { status: 'DELIVERED' },
          assignedAt: { gte: today, lte: todayEnd },
        },
      });

      const todayFailed = await prisma.deliveryAssignment.count({
        where: {
          driverId: driver.id,
          shipment: { status: 'DELIVERY_FAILED' },
          assignedAt: { gte: today, lte: todayEnd },
        },
      });

      const todayRescheduled = await prisma.deliveryAssignment.count({
        where: {
          driverId: driver.id,
          shipment: { status: 'RESCHEDULED' },
          assignedAt: { gte: today, lte: todayEnd },
        },
      });

      await prisma.dailyReport.upsert({
        where: {
          driverId_reportDate: { driverId: driver.id, reportDate: today },
        },
        create: {
          driverId: driver.id,
          reportDate: now,
          deliveredCount: todayDelivered,
          failedCount: todayFailed,
          rescheduledCount: todayRescheduled,
        },
        update: {
          deliveredCount: todayDelivered,
          failedCount: todayFailed,
          rescheduledCount: todayRescheduled,
        },
      });

      const latestAssignment = await prisma.deliveryAssignment.findFirst({
        where: { driverId: driver.id },
        orderBy: { assignedAt: 'desc' },
        include: { shipment: { select: { id: true, trackingNumber: true, destination: true } } },
      });

      await prisma.notification.create({
        data: {
          userId: session?.id,
          tenantId: session?.tenantId,
          shipmentId: latestAssignment?.shipmentId ?? null,
          type: 'SUCCESS',
          title: 'Tugas telah selesai',
          message: latestAssignment?.shipment
            ? `Tugas telah selesai — ${latestAssignment.shipment.trackingNumber} telah kembali ke gudang. Terima kasih atas kerja kerasnya!`
            : 'Tugas telah selesai — Anda telah tiba di gudang. Terima kasih atas kerja kerasnya!',
        },
      });

      if (latestAssignment?.shipmentId) {
        await prisma.notification.create({
          data: {
            shipmentId: latestAssignment.shipmentId,
            tenantId: session?.tenantId,
            message: `${latestAssignment.shipment.trackingNumber}: Driver telah tiba di gudang`,
          },
        });
      }

      await logAudit(session, 'DRIVER_RETURN_COMPLETE', 'DRIVER', { newData: { returning: false, returnedAt: now.toISOString(), driverStatus: 'ACTIVE', vehicleStatus: 'AVAILABLE' } }, req);
      return NextResponse.json({ driver: updated, deliveredCount: todayDelivered });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal (start/complete)' }, { status: 400 });
  });
}
