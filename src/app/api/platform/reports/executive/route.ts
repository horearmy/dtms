import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type Period = { from: Date; to: Date };

function parsePeriod(searchParams: URLSearchParams): Period {
  const preset = searchParams.get('preset') || 'this_month';
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { from: startOfDay, to: now };
    case 'last_7_days': {
      const from = new Date(startOfDay);
      from.setDate(from.getDate() - 6);
      return { from, to: now };
    }
    case 'last_30_days': {
      const from = new Date(startOfDay);
      from.setDate(from.getDate() - 29);
      return { from, to: now };
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from, to };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const from = new Date(now.getFullYear(), q * 3, 1);
      return { from, to: now };
    }
    case 'this_year':
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case 'custom': {
      const fromStr = searchParams.get('from');
      const toStr = searchParams.get('to');
      const from = fromStr ? new Date(fromStr) : startOfDay;
      const to = toStr ? new Date(toStr) : now;
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('Invalid date');
      }
      return { from, to };
    }
    case 'this_month':
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
}

function prevPeriod(p: Period): Period {
  const diff = p.to.getTime() - p.from.getTime();
  return { from: new Date(p.from.getTime() - diff), to: new Date(p.from.getTime() - 1) };
}

function fmtRp(v: number): string {
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `Rp ${(v / 1_000).toFixed(0)}K`;
  return `Rp ${v}`;
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW, 'SUPER_ADMIN');
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    let period: Period;
    try { period = parsePeriod(req.nextUrl.searchParams); } catch { return NextResponse.json({ error: 'Invalid date parameters' }, { status: 400 }); }
    const prev = prevPeriod(period);

    const [
      tenantCurrent,
      tenantPrev,
      shipmentCurrent,
      shipmentPrev,
      deliveredCurrent,
      failedCurrent,
      slaEvents,
      invoiceAgg,
      prevInvoiceAgg,
      userCount,
      driverCount,
      vehicleCount,
      integrationLogs,
      exceptionCount,
    ] = await Promise.all([
      prisma.tenant.count({ where: { createdAt: { gte: period.from, lte: period.to } } }),
      prisma.tenant.count({ where: { createdAt: { gte: prev.from, lte: prev.to } } }),
      prisma.shipment.count({ where: { createdAt: { gte: period.from, lte: period.to } } }),
      prisma.shipment.count({ where: { createdAt: { gte: prev.from, lte: prev.to } } }),
      prisma.shipment.count({ where: { status: 'DELIVERED', createdAt: { gte: period.from, lte: period.to } } }),
      prisma.shipment.count({ where: { status: 'DELIVERY_FAILED', createdAt: { gte: period.from, lte: period.to } } }),
      prisma.slaEvent.groupBy({
        by: ['status'],
        where: { createdAt: { gte: period.from, lte: period.to } },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: period.from, lte: period.to }, status: { not: 'VOID' } },
        _sum: { total: true, paidAmount: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: prev.from, lte: prev.to }, status: { not: 'VOID' } },
        _sum: { total: true, paidAmount: true },
      }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.driver.count({ where: { status: 'ACTIVE' } }),
      prisma.vehicle.count({ where: { status: { in: ['AVAILABLE', 'IN_USE'] } } }),
      prisma.integrationLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { statusCode: true, error: true, durationMs: true },
      }),
      prisma.exception.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] } } }),
    ]);

    const totalTenants = await prisma.tenant.count();
    const activeTenants = await prisma.tenant.count({ where: { status: 'ACTIVE' } });

    const prevTenants = totalTenants - tenantCurrent + tenantPrev;
    const tenantGrowthPct = prevTenants > 0 ? ((totalTenants - prevTenants) / prevTenants) * 100 : 0;

    const deliveryGrowthPct = shipmentPrev > 0 ? ((shipmentCurrent - shipmentPrev) / shipmentPrev) * 100 : 0;

    const totalSla = slaEvents.reduce((s, e) => s + e._count, 0);
    const onTime = slaEvents.find((e) => e.status === 'ON_TRACK')?._count || 0;
    const breached = slaEvents.find((e) => e.status === 'BREACHED')?._count || 0;
    const atRisk = slaEvents.find((e) => e.status === 'AT_RISK')?._count || 0;
    const slaOnTimeRate = totalSla > 0 ? (onTime / totalSla) * 100 : 0;

    const totalBilled = Number(invoiceAgg._sum.total || 0);
    const totalCollected = Number(invoiceAgg._sum.paidAmount || 0);
    const mrr = totalBilled;
    const arr = mrr * 12;
    const outstanding = totalBilled - totalCollected;
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    const prevBilled = Number(prevInvoiceAgg._sum.total || 0);
    const revenueGrowthPct = prevBilled > 0 ? ((totalBilled - prevBilled) / prevBilled) * 100 : 0;

    const overdueInvoices = await prisma.invoice.count({
      where: { status: 'OVERDUE' },
    });

    const overdueAmountAgg = await prisma.invoice.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { total: true },
    });
    const overdueAmount = Number(overdueAmountAgg._sum.total || 0);

    const successRate = integrationLogs.length > 0
      ? (integrationLogs.filter((l) => l.statusCode != null && l.statusCode >= 200 && l.statusCode < 400).length / integrationLogs.length) * 100
      : 99.9;
    const avgLatency = integrationLogs.length > 0
      ? integrationLogs.reduce((s, l) => s + (l.durationMs || 0), 0) / integrationLogs.length
      : 0;

    const successRatePct = shipmentCurrent > 0 ? (deliveredCurrent / shipmentCurrent) * 100 : 0;
    const failureRatePct = shipmentCurrent > 0 ? (failedCurrent / shipmentCurrent) * 100 : 0;

    const tenantStatusCounts = await prisma.tenant.groupBy({
      by: ['status'],
      _count: true,
    });

    const shipmentByStatus = await prisma.shipment.groupBy({
      by: ['status'],
      where: { createdAt: { gte: period.from, lte: period.to } },
      _count: true,
      orderBy: { _count: { status: 'desc' } },
    });

    const shipmentByService = await prisma.shipment.groupBy({
      by: ['serviceType'],
      where: { createdAt: { gte: period.from, lte: period.to } },
      _count: true,
    });

    const alerts: Array<{ severity: string; title: string; description: string; count: number }> = [];

    if (overdueInvoices > 0) {
      alerts.push({
        severity: 'HIGH',
        title: `${overdueInvoices} invoice overdue`,
        description: `Total Rp ${(overdueAmount / 1_000_000).toFixed(1)}M perlu follow-up collection`,
        count: overdueInvoices,
      });
    }

    const slaBreachedCount = breached;
    if (slaBreachedCount > 0) {
      alerts.push({
        severity: 'CRITICAL',
        title: `${slaBreachedCount} shipment melanggar SLA`,
        description: 'Perlu review operasional tenant yang terdampak',
        count: slaBreachedCount,
      });
    }

    if (failedCurrent > 0) {
      alerts.push({
        severity: 'MEDIUM',
        title: `${failedCurrent} shipment gagal dikirim`,
        description: `Failure rate ${failureRatePct.toFixed(1)}% dari total ${shipmentCurrent} shipment`,
        count: failedCurrent,
      });
    }

    if (exceptionCount > 0) {
      alerts.push({
        severity: 'HIGH',
        title: `${exceptionCount} exception masih terbuka`,
        description: 'Exception yang belum diselesaikan perlu perhatian',
        count: exceptionCount,
      });
    }

    const insights: Array<{ type: string; text: string }> = [];

    if (tenantGrowthPct > 0) {
      insights.push({ type: 'positive', text: `Tenant aktif meningkat ${tenantGrowthPct.toFixed(1)}% dibanding periode sebelumnya.` });
    }
    if (deliveryGrowthPct > 0) {
      insights.push({ type: 'positive', text: `Volume pengiriman meningkat ${deliveryGrowthPct.toFixed(1)}% (${shipmentPrev} → ${shipmentCurrent}).` });
    }
    if (revenueGrowthPct > 0) {
      insights.push({ type: 'positive', text: `Revenue meningkat ${revenueGrowthPct.toFixed(1)}%. Collection rate ${collectionRate.toFixed(1)}%.` });
    }
    if (overdueInvoices > 0) {
      insights.push({ type: 'attention', text: `${overdueInvoices} invoice belum dibayar (overdue). Total outstanding Rp ${(overdueAmount / 1_000_000).toFixed(1)}M.` });
    }
    if (slaBreachedCount > shipmentCurrent * 0.05 && shipmentCurrent > 0) {
      insights.push({ type: 'critical', text: `SLA breach rate ${(slaBreachedCount / shipmentCurrent * 100).toFixed(1)}% melebihi threshold 5%. Review delivery performance.` });
    }
    if (collectionRate < 80 && totalBilled > 0) {
      insights.push({ type: 'attention', text: `Collection rate ${collectionRate.toFixed(1)}% di bawah target 80%. Perlu strategi collection.` });
    }

    return NextResponse.json({
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      tenant: {
        total: totalTenants,
        active: activeTenants,
        newThisPeriod: tenantCurrent,
        byStatus: tenantStatusCounts.map((s) => ({ status: s.status, count: s._count })),
        growth: { current: totalTenants, previous: prevTenants, changePct: Number(tenantGrowthPct.toFixed(1)) },
      },
      delivery: {
        total: shipmentCurrent,
        delivered: deliveredCurrent,
        failed: failedCurrent,
        inTransit: shipmentByStatus.find((s) => s.status === 'IN_TRANSIT')?._count || 0,
        active: shipmentByStatus
          .filter((s) => ['ORDER_CREATED', 'WAREHOUSE_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'RESCHEDULED'].includes(s.status))
          .reduce((sum, s) => sum + s._count, 0),
        successRate: Number(successRatePct.toFixed(1)),
        failureRate: Number(failureRatePct.toFixed(1)),
        byStatus: shipmentByStatus.map((s) => ({ status: s.status, count: s._count })),
        byServiceType: shipmentByService.map((s) => ({ serviceType: s.serviceType, count: s._count })),
        growth: { current: shipmentCurrent, previous: shipmentPrev, changePct: Number(deliveryGrowthPct.toFixed(1)) },
      },
      sla: {
        onTimeRate: Number(slaOnTimeRate.toFixed(1)),
        onTime,
        atRisk,
        breached,
        totalEvaluated: totalSla,
      },
      revenue: {
        mrr,
        arr,
        totalBilled,
        totalCollected,
        outstanding,
        overdueAmount,
        overdueCount: overdueInvoices,
        collectionRate: Number(collectionRate.toFixed(1)),
        growth: { current: totalBilled, previous: prevBilled, changePct: Number(revenueGrowthPct.toFixed(1)) },
        fmtMrr: fmtRp(mrr),
        fmtArr: fmtRp(arr),
      },
      usage: {
        activeUsers: userCount,
        activeDrivers: driverCount,
        activeVehicles: vehicleCount,
        totalShipments: shipmentCurrent,
        openExceptions: exceptionCount,
      },
      health: {
        apiSuccessRate: Number(successRate.toFixed(1)),
        avgLatencyMs: Number(avgLatency.toFixed(0)),
        integrationLogs: integrationLogs.length,
      },
      alerts,
      insights,
    });
  });
}
