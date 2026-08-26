import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { Prisma } from '@prisma/client';

type Period = { from: Date; to: Date };

function parsePeriod(sp: URLSearchParams): Period {
  const preset = sp.get('preset') || 'this_month';
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today': return { from: sod, to: now };
    case 'last_7_days': { const f = new Date(sod); f.setDate(f.getDate() - 6); return { from: f, to: now }; }
    case 'last_30_days': { const f = new Date(sod); f.setDate(f.getDate() - 29); return { from: f, to: now }; }
    case 'last_month': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
    case 'this_quarter': { const q = Math.floor(now.getMonth() / 3); return { from: new Date(now.getFullYear(), q * 3, 1), to: now }; }
    case 'this_year': return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case 'custom': return { from: new Date(sp.get('from') || sod), to: new Date(sp.get('to') || now) };
    case 'this_month': default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const period = parsePeriod(req.nextUrl.searchParams);
    const tf: Prisma.VehicleWhereInput = session?.tenantId ? { tenantId: session.tenantId } : {};
    const dtf: Prisma.DriverWhereInput = session?.tenantId ? { tenantId: session.tenantId } : {};
    const gf: Prisma.GpsLogWhereInput = session?.tenantId ? { driver: { tenantId: session.tenantId } } : {};
    const af: Prisma.DeliveryAssignmentWhereInput = session?.tenantId ? { shipment: { tenantId: session.tenantId } } : {};

    const [
      totalVehicles,
      vehicleByStatus,
      totalDrivers,
      driverByStatus,
      assignmentsCount,
      prevAssignmentsCount,
      activeDriversWithGps,
      gpsLogCount,
      prevGpsLogCount,
      avgSpeedResult,
      totalDistanceResult,
      maintenanceRecords,
      idleVehicles,
      assignmentsByDay,
      topDrivers,
      topVehicles,
    ] = await Promise.all([
      prisma.vehicle.count({ where: tf }),
      prisma.vehicle.groupBy({ by: ['status'], where: tf, _count: true }),
      prisma.driver.count({ where: dtf }),
      prisma.driver.groupBy({ by: ['status'], where: dtf, _count: true }),
      prisma.deliveryAssignment.count({
        where: { ...af, assignedAt: { gte: period.from, lte: period.to } },
      }),
      prisma.deliveryAssignment.count({
        where: {
          ...af,
          assignedAt: {
            gte: new Date(period.from.getTime() - (period.to.getTime() - period.from.getTime())),
            lt: period.from,
          },
        },
      }),
      prisma.driver.count({
        where: {
          ...dtf,
          status: 'ACTIVE',
          gpsLogs: { some: { createdAt: { gte: new Date(Date.now() - 3600000) } } },
        },
      }),
      prisma.gpsLog.count({ where: { ...gf, createdAt: { gte: period.from, lte: period.to } } }),
      prisma.gpsLog.count({
        where: {
          ...gf,
          createdAt: {
            gte: new Date(period.from.getTime() - (period.to.getTime() - period.from.getTime())),
            lt: period.from,
          },
        },
      }),
      prisma.gpsLog.aggregate({
        where: { ...gf, createdAt: { gte: period.from, lte: period.to }, speed: { not: null } },
        _avg: { speed: true },
      }),
      prisma.vehicle.aggregate({
        where: tf,
        _sum: { totalDistanceKm: true },
      }),
      prisma.vehicleMaintenance.findMany({
        where: session?.tenantId ? { vehicle: { tenantId: session.tenantId } } : {},
        select: { id: true, vehicleId: true, type: true, cost: true, performedAt: true, odometerKm: true },
        orderBy: { performedAt: 'desc' },
        take: 50,
      }),
      prisma.vehicle.findMany({
        where: {
          ...tf,
          status: 'AVAILABLE',
          gpsLogs: { none: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } },
        },
        select: { id: true, vehicleNumber: true, type: true },
        take: 20,
      }),
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("assignedAt") as date, COUNT(*) as count
        FROM "DeliveryAssignment"
        WHERE "assignedAt" >= ${period.from} AND "assignedAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND "shipmentId" IN (SELECT id FROM "Shipment" WHERE "tenantId" = ${session.tenantId})` : Prisma.sql``}
        GROUP BY DATE("assignedAt")
        ORDER BY date ASC
      `,
      prisma.driver.findMany({
        where: dtf,
        select: {
          id: true, name: true, employeeId: true,
          _count: { select: { assignments: { where: { assignedAt: { gte: period.from, lte: period.to } } } } },
        },
        orderBy: { assignments: { _count: 'desc' } },
        take: 10,
      }),
      prisma.vehicle.findMany({
        where: tf,
        select: {
          id: true, vehicleNumber: true, type: true, totalDistanceKm: true, status: true,
          _count: { select: { assignments: { where: { assignedAt: { gte: period.from, lte: period.to } } } } },
        },
        orderBy: { assignments: { _count: 'desc' } },
        take: 10,
      }),
    ]);

    const inUse = vehicleByStatus.find((v) => v.status === 'IN_USE')?._count || 0;
    const available = vehicleByStatus.find((v) => v.status === 'AVAILABLE')?._count || 0;
    const maintenance = vehicleByStatus.find((v) => v.status === 'MAINTENANCE')?._count || 0;
    const utilizationRate = totalVehicles > 0 ? (inUse / totalVehicles) * 100 : 0;

    const activeDrivers = driverByStatus.find((d) => d.status === 'ACTIVE')?._count || 0;
    const driverUtilization = activeDrivers > 0 ? (activeDriversWithGps / activeDrivers) * 100 : 0;

    const assignmentGrowth = prevAssignmentsCount > 0
      ? ((assignmentsCount - prevAssignmentsCount) / prevAssignmentsCount) * 100
      : 0;

    const gpsGrowth = prevGpsLogCount > 0
      ? ((gpsLogCount - prevGpsLogCount) / prevGpsLogCount) * 100
      : 0;

    const avgSpeed = Number(((avgSpeedResult._avg.speed || 0)).toFixed(1));
    const totalDistance = Number((totalDistanceResult._sum.totalDistanceKm || 0).toFixed(0));

    const recentMaintenance = maintenanceRecords.filter(
      (m) => m.performedAt >= period.from && m.performedAt <= period.to
    );
    const totalMaintenanceCost = recentMaintenance.reduce((sum, m) => sum + (m.cost || 0), 0);

    const insights: Array<{ type: string; text: string }> = [];

    if (utilizationRate < 50) {
      insights.push({ type: 'attention', text: `Vehicle utilization ${utilizationRate.toFixed(0)}% — di bawah target 50%. ${available} kendaraan idle.` });
    }
    if (utilizationRate > 85) {
      insights.push({ type: 'critical', text: `Vehicle utilization ${utilizationRate.toFixed(0)}% — mendekati kapasitas maksimal. Pertambahan armada mungkin diperlukan.` });
    }
    if (driverUtilization < 40) {
      insights.push({ type: 'attention', text: `Hanya ${activeDriversWithGps} dari ${activeDrivers} driver aktif memiliki GPS activity aktif (${driverUtilization.toFixed(0)}%).` });
    }
    if (idleVehicles.length > 3) {
      insights.push({ type: 'attention', text: `${idleVehicles.length} kendaraan idle >7 hari tanpa GPS activity. Perlu review status.` });
    }
    if (assignmentGrowth > 20) {
      insights.push({ type: 'positive', text: `Assignment meningkat ${assignmentGrowth.toFixed(1)}% — workload fleet naik.` });
    }
    if (totalMaintenanceCost > 0) {
      insights.push({ type: 'info', text: `Total biaya maintenance periode ini: Rp ${(totalMaintenanceCost / 1_000_000).toFixed(1)}M dari ${recentMaintenance.length} record.` });
    }

    return NextResponse.json({
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      vehicle: {
        total: totalVehicles,
        inUse,
        available,
        maintenance,
        idle: idleVehicles.length,
        utilizationRate: Number(utilizationRate.toFixed(1)),
        totalDistanceKm: totalDistance,
      },
      driver: {
        total: totalDrivers,
        active: activeDrivers,
        withGpsActivity: activeDriversWithGps,
        utilizationRate: Number(driverUtilization.toFixed(1)),
      },
      assignment: {
        total: assignmentsCount,
        growthPct: Number(assignmentGrowth.toFixed(1)),
      },
      gps: {
        totalLogs: gpsLogCount,
        growthPct: Number(gpsGrowth.toFixed(1)),
        avgSpeed,
      },
      maintenance: {
        recentCount: recentMaintenance.length,
        totalCost: totalMaintenanceCost,
        records: recentMaintenance.slice(0, 20).map((m) => ({
          id: m.id, vehicleId: m.vehicleId, type: m.type,
          performedAt: m.performedAt.toISOString(),
          cost: m.cost || 0,
          odometerKm: m.odometerKm || 0,
        })),
      },
      idle: idleVehicles.map((v) => ({ id: v.id, vehicleNumber: v.vehicleNumber, type: v.type })),
      trend: assignmentsByDay.map((r) => ({ date: r.date.toISOString().split('T')[0], count: Number(r.count) })),
      topDrivers: topDrivers.map((d) => ({ id: d.id, name: d.name, employeeId: d.employeeId, assignmentCount: d._count.assignments })),
      topVehicles: topVehicles.map((v) => ({ id: v.id, vehicleNumber: v.vehicleNumber, type: v.type, status: v.status, distanceKm: v.totalDistanceKm, assignmentCount: v._count.assignments })),
      insights,
    });
  });
}
