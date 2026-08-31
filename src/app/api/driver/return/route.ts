import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { VEHICLE_CHECK_ITEMS } from '@/lib/vehicle-checklist';

function normalizeWarehouseCode(raw: string): string {
  return String(raw || '').trim().replace(/^WH[:#]/i, '');
}

function safeNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

      // 1) Wajib scan QR gudang asal untuk konfirmasi tiba.
      const warehouseCode = normalizeWarehouseCode(body?.warehouseCode);
      if (!warehouseCode) {
        return NextResponse.json({ error: 'Anda wajib scan QR gudang asal untuk konfirmasi tiba di gudang' }, { status: 400 });
      }
      const warehouse = await prisma.warehouse.findFirst({
        where: { code: warehouseCode, tenantId: session?.tenantId ?? undefined, active: true },
      });
      if (!warehouse) {
        return NextResponse.json({ error: 'Kode gudang tidak valid untuk organisasi Anda' }, { status: 404 });
      }

      // 2) Wajib ceklist kendaraan pasca perjalanan.
      const rawAnswers = (body?.answers ?? {}) as Record<string, unknown>;
      const answers: Record<string, 'ok' | 'issue'> = {};
      const issues: string[] = [];
      for (const item of VEHICLE_CHECK_ITEMS) {
        const val = rawAnswers[item.key];
        const status = val === 'issue' ? 'issue' : 'ok';
        answers[item.key] = status;
        if (status === 'issue') issues.push(item.key);
      }
      const notes = body?.notes ? String(body.notes).trim().slice(0, 500) : null;

      const now = new Date();
      const latest = await prisma.deliveryAssignment.findFirst({
        where: { driverId: driver.id },
        orderBy: { assignedAt: 'desc' },
        select: { vehicleId: true, shipmentId: true },
      });

      const hadIssue = issues.length > 0;
      const vehicleStatus = hadIssue ? 'MAINTENANCE' : 'AVAILABLE';

      if (!latest?.vehicleId) {
        return NextResponse.json({ error: 'Tidak ada kendaraan untuk diselesaikan perjalanannya' }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.vehicleCheck.create({
          data: {
            vehicleId: latest.vehicleId!,
            driverId: driver.id,
            warehouseId: warehouse.id,
            shipmentId: latest?.shipmentId ?? null,
            answers,
            issues,
            hasIssue: hadIssue,
            notes,
            latitude: safeNumber(body?.lat),
            longitude: safeNumber(body?.lng),
          },
        });

        await tx.driver.update({
          where: { id: driver.id },
          data: { returning: false, returnedAt: now, status: 'ACTIVE' },
        });

        await tx.vehicle.update({
          where: { id: latest.vehicleId! },
          data: { returning: false, returnedAt: now, status: vehicleStatus },
        });

        await tx.notification.create({
          data: {
            userId: session?.id,
            tenantId: session?.tenantId,
            shipmentId: latest?.shipmentId ?? null,
            type: hadIssue ? 'WARNING' : 'SUCCESS',
            title: hadIssue ? 'Kendaraan memerlukan perawatan' : 'Tugas telah selesai',
            message: hadIssue
              ? `Ceklist pasca perjalanan menemukan masalah pada kendaraan. Kendaraan dialihkan ke perawatan (MAINTENANCE).`
              : `Tugas telah selesai — Anda telah tiba di gudang ${warehouse.name}. Terima kasih atas kerja kerasnya!`,
          },
        });

        if (latest?.shipmentId) {
          await tx.notification.create({
            data: {
              shipmentId: latest.shipmentId,
              tenantId: session?.tenantId,
              message: `${latest.shipmentId}: Driver telah tiba di gudang ${warehouse.name}`,
            },
          });
        }
      });

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

      await logAudit(session, 'DRIVER_RETURN_COMPLETE', 'DRIVER', { newData: { returning: false, returnedAt: now.toISOString(), driverStatus: 'ACTIVE', vehicleStatus, warehouse: warehouse.name, issueCount: issues.length } }, req);
      return NextResponse.json({ ok: true, vehicleStatus, issueCount: issues.length, deliveredCount: todayDelivered });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal (start/complete)' }, { status: 400 });
  });
}
