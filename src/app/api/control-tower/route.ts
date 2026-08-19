import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.CONTROL_TOWER.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const [totalShipments, activeShipments, deliveredToday, failedToday, slaBreaches, slaAtRisk, openExceptions, criticalExceptions, activeDrivers, totalDrivers, activeVehicles, totalVehicles, recentEvents] = await Promise.all([
      prisma.shipment.count(),
      prisma.shipment.count({ where: { status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_HUB'] } } }),
      prisma.shipment.count({ where: { status: 'DELIVERED', updatedAt: { gte: startOfDay() } } }),
      prisma.shipment.count({ where: { status: 'DELIVERY_FAILED', updatedAt: { gte: startOfDay() } } }),
      prisma.slaEvent.count({ where: { status: 'BREACHED' } }),
      prisma.slaEvent.count({ where: { status: 'AT_RISK' } }),
      prisma.exception.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] } } }),
      prisma.exception.count({ where: { severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } }),
      prisma.driver.count({ where: { status: 'ACTIVE' } }),
      prisma.driver.count(),
      prisma.vehicle.count({ where: { status: 'IN_USE' } }),
      prisma.vehicle.count(),
      prisma.shipmentEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { shipment: { select: { trackingNumber: true } } } }),
    ]);

    const slaOnTrack = activeShipments - slaBreaches - slaAtRisk;

    return NextResponse.json({
      kpi: {
        totalShipments,
        activeShipments,
        deliveredToday,
        failedToday,
        slaBreaches,
        slaAtRisk,
        slaOnTrack: Math.max(0, slaOnTrack),
        onTimeRate: activeShipments > 0 ? Math.round((slaOnTrack / activeShipments) * 100) : 100,
      },
      resources: {
        activeDrivers,
        totalDrivers,
        activeVehicles,
        totalVehicles,
      },
      alerts: {
        openExceptions,
        criticalExceptions,
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        trackingNumber: e.shipment?.trackingNumber || '-',
      })),
    });
  });
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
