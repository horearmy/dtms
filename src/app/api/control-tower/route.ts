import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.CONTROL_TOWER.VIEW);
  if (error) return error;

  const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};

  const [totalShipments, activeShipments, deliveredToday, failedToday, slaBreaches, slaAtRisk, openExceptions, criticalExceptions, activeDrivers, totalDrivers, activeVehicles, totalVehicles, recentEvents] = await Promise.all([
    prisma.shipment.count({ where: tenantFilter }),
    prisma.shipment.count({ where: { ...tenantFilter, status: { in: ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_HUB'] } } }),
    prisma.shipment.count({ where: { ...tenantFilter, status: 'DELIVERED', updatedAt: { gte: startOfDay() } } }),
    prisma.shipment.count({ where: { ...tenantFilter, status: 'DELIVERY_FAILED', updatedAt: { gte: startOfDay() } } }),
    prisma.slaEvent.count({ where: { ...tenantFilter, status: 'BREACHED' } }),
    prisma.slaEvent.count({ where: { ...tenantFilter, status: 'AT_RISK' } }),
    prisma.exception.count({ where: { ...tenantFilter, status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] } } }),
    prisma.exception.count({ where: { ...tenantFilter, severity: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } }),
    prisma.driver.count({ where: { ...tenantFilter, status: 'ACTIVE' } }),
    prisma.driver.count({ where: tenantFilter }),
    prisma.vehicle.count({ where: { ...tenantFilter, status: 'IN_USE' } }),
    prisma.vehicle.count({ where: tenantFilter }),
    prisma.shipmentEvent.findMany({ where: tenantFilter, orderBy: { createdAt: 'desc' }, take: 20, include: { shipment: { select: { trackingNumber: true } } } }),
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
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
