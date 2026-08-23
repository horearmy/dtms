import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.GPS.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const isSuperAdmin = session!.role === 'SUPER_ADMIN';
    const minutes = Math.min(240, Math.max(5, parseInt(req.nextUrl.searchParams.get('minutes') || '60', 10)));
    const now = Date.now();
    const currentStart = new Date(now - minutes * 60 * 1000);
    const prevStart = new Date(now - minutes * 2 * 60 * 1000);

    const gpsWhere: Record<string, unknown> = { createdAt: { gte: currentStart } };
    const prevGpsWhere: Record<string, unknown> = { createdAt: { gte: prevStart, lt: currentStart } };
    if (!isSuperAdmin) {
      gpsWhere.Driver = { tenantId: session!.tenantId };
      prevGpsWhere.Driver = { tenantId: session!.tenantId };
    }

    const [gpsLogs, prevGpsLogs, blockedCountNow, blockedCountPrev, tenantCountNow, tenantCountPrev] = await Promise.all([
      prisma.gpsLog.findMany({
        where: gpsWhere,
        select: {
          latitude: true,
          longitude: true,
          speed: true,
          driver: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              tenant: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      prisma.gpsLog.findMany({
        where: prevGpsWhere,
        select: { driver: { select: { id: true } } },
        take: 5000,
      }),
      prisma.tenantRateLimit.count({ where: { blocked: true } }),
      prisma.tenantRateLimit.count({ where: { blocked: true, createdAt: { lt: currentStart } } }),
      prisma.tenant.count({ where: { active: true } }),
      prisma.tenant.count({ where: { active: true, createdAt: { lt: currentStart } } }),
    ]);

    const latestByDriver = new Map<string, typeof gpsLogs[0]>();
    for (const log of gpsLogs) {
      if (!latestByDriver.has(log.driver.id)) {
        latestByDriver.set(log.driver.id, log);
      }
    }

    const points = Array.from(latestByDriver.values())
      .filter((log) => log.driver.tenantId)
      .map((log) => ({
        lat: log.latitude,
        lng: log.longitude,
        intensity: Math.min(1, (log.speed ?? 0) / 80),
        tenantId: log.driver.tenantId!,
        tenantName: log.driver.tenant?.name || 'Unknown',
        driverName: log.driver.name,
        driverId: log.driver.id,
      }));

    const tenantStats = new Map<string, { name: string; driverCount: number; pointCount: number }>();
    for (const p of points) {
      const existing = tenantStats.get(p.tenantId);
      if (existing) {
        existing.pointCount++;
      } else {
        tenantStats.set(p.tenantId, { name: p.tenantName, driverCount: 0, pointCount: 1 });
      }
    }

    const driverCounts = new Map<string, Set<string>>();
    for (const log of gpsLogs) {
      if (!log.driver.tenantId) continue;
      const set = driverCounts.get(log.driver.tenantId);
      if (set) set.add(log.driver.id);
      else driverCounts.set(log.driver.tenantId, new Set([log.driver.id]));
    }
    for (const [tenantId, count] of driverCounts) {
      const stat = tenantStats.get(tenantId);
      if (stat) stat.driverCount = count.size;
    }

    const currentDrivers = new Set(gpsLogs.map((l) => l.driver.id)).size;
    const prevDrivers = new Set(prevGpsLogs.map((l) => l.driver.id)).size;
    const driverTrend = prevDrivers > 0 ? Math.round(((currentDrivers - prevDrivers) / prevDrivers) * 100) : 0;

    return NextResponse.json({
      points,
      tenantStats: Object.fromEntries(tenantStats),
      total: points.length,
      minutes,
      trends: {
        driverTrend,
        blockedTrend: blockedCountNow - blockedCountPrev,
        tenantTrend: tenantCountNow - tenantCountPrev,
      },
    });
  });
}
