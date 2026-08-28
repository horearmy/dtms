// src/app/api/health/dashboard/route.ts
// Performance probe for dashboard DB queries. Call with header X-API-Key.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ACTIVE_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function elapsedMs(start: bigint): number {
  return Math.round(Number(process.hrtime.bigint() - start) / 1_000_000 * 100) / 100;
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.HEALTH_API_KEY || process.env.SUPERADMIN_SECRET_KEY;
  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId: string | null = null;
  const tenantFilter = tenantId ? { tenantId } : {};
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const timings: Record<string, number> = {};
  const overallStart = process.hrtime.bigint();

  // Aggregate counts (same as cached dashboard stats)
  const countsStart = process.hrtime.bigint();
  const [totalToday, totalCount, deliveredCount, activeCount, failedCount, activeDrivers, activeVehicles, totalBranches, activeBranches] = await Promise.all([
    prisma.shipment.count({ where: { createdAt: { gte: todayStart }, ...tenantFilter } }),
    prisma.shipment.count({ where: tenantFilter }),
    prisma.shipment.count({ where: { status: 'DELIVERED', ...tenantFilter } }),
    prisma.shipment.count({ where: { status: { in: ACTIVE_STATUSES as never[] }, ...tenantFilter } }),
    prisma.shipment.count({ where: { status: 'DELIVERY_FAILED', ...tenantFilter } }),
    prisma.driver.count({ where: { status: 'ACTIVE', ...tenantFilter } }),
    prisma.vehicle.count({ where: { status: { in: ['AVAILABLE', 'IN_USE'] }, ...tenantFilter } }),
    prisma.branch.count({ where: tenantFilter }),
    prisma.branch.count({ where: { active: true, ...tenantFilter } }),
  ]);
  timings.counts = elapsedMs(countsStart);

  // Active shipments list
  const activeStart = process.hrtime.bigint();
  await prisma.shipment.findMany({
    where: {
      status: { notIn: ['DELIVERED', 'RETURNED', 'DELIVERY_FAILED', 'RETURN_TO_SENDER'] },
      ...tenantFilter,
    },
    include: { sender: true, receiver: true, assignments: { include: { driver: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  timings.activeShipments = elapsedMs(activeStart);

  // Recent shipments
  const recentStart = process.hrtime.bigint();
  await prisma.shipment.findMany({
    where: tenantFilter,
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { sender: true, receiver: true, assignments: { include: { driver: true } } },
  });
  timings.recentShipments = elapsedMs(recentStart);

  // Geofence events
  const geofenceStart = process.hrtime.bigint();
  await prisma.geofenceEvent.findMany({
    where: tenantId ? { geofence: { tenantId } } : {},
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { geofence: { select: { name: true } }, driver: { select: { name: true } } },
  });
  timings.geofenceEvents = elapsedMs(geofenceStart);

  // Branch overview
  const branchStart = process.hrtime.bigint();
  await prisma.branch.findMany({
    where: tenantFilter,
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      organization: { select: { name: true } },
      region: { select: { name: true } },
      _count: { select: { users: true, warehouses: true, hubs: true } },
    },
  });
  timings.branches = elapsedMs(branchStart);

  timings.total = elapsedMs(overallStart);

  const healthy =
    timings.total < 2000 &&
    timings.activeShipments < 1000 &&
    timings.recentShipments < 800 &&
    timings.branches < 600;

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      timings,
      counts: {
        totalToday,
        totalCount,
        deliveredCount,
        activeCount,
        failedCount,
        activeDrivers,
        activeVehicles,
        totalBranches,
        activeBranches,
      },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
