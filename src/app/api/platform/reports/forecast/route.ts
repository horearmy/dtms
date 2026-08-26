import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (const p of points) { sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; sy2 += p.y * p.y; }
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const ssTot = sy2 - (sy * sy) / n;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
}

function monthKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  const months = Math.min(parseInt(req.nextUrl.searchParams.get('months') || '12', 10), 24);

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);

    const [shipments, invoices] = await Promise.all([
      prisma.shipment.findMany({
        where: { ...tenantFilter, createdAt: { gte: startDate } },
        select: { createdAt: true, status: true },
      }),
      prisma.invoice.findMany({
        where: { ...tenantFilter, createdAt: { gte: startDate }, status: { not: 'VOID' } },
        select: { createdAt: true, total: true, paidAmount: true },
      }),
    ]);

    // Aggregate by month
    const shipmentByMonth = new Map<string, { delivered: number; total: number; failed: number }>();
    for (const s of shipments) {
      const key = monthKey(s.createdAt);
      const cur = shipmentByMonth.get(key) || { delivered: 0, total: 0, failed: 0 };
      cur.total++;
      if (s.status === 'DELIVERED') cur.delivered++;
      if (s.status === 'DELIVERY_FAILED') cur.failed++;
      shipmentByMonth.set(key, cur);
    }

    const revenueByMonth = new Map<string, { billed: number; collected: number }>();
    for (const inv of invoices) {
      const key = monthKey(inv.createdAt);
      const cur = revenueByMonth.get(key) || { billed: 0, collected: 0 };
      cur.billed += Number(inv.total);
      cur.collected += Number(inv.paidAmount);
      revenueByMonth.set(key, cur);
    }

    // Build sorted month labels (last 12 months + forecast)
    const allMonths: string[] = [];
    const d = new Date(startDate);
    while (d <= now) {
      allMonths.push(monthKey(d));
      d.setMonth(d.getMonth() + 1);
    }

    const historicalShipments = allMonths.map((m, i) => ({
      month: m,
      delivered: shipmentByMonth.get(m)?.delivered || 0,
      total: shipmentByMonth.get(m)?.total || 0,
      failed: shipmentByMonth.get(m)?.failed || 0,
    }));

    const historicalRevenue = allMonths.map((m, i) => ({
      month: m,
      billed: revenueByMonth.get(m)?.billed || 0,
      collected: revenueByMonth.get(m)?.collected || 0,
    }));

    // Fit linear regression on last 12 months
    const recent12 = historicalShipments.slice(-12);
    const shipRegression = linearRegression(recent12.map((s, i) => ({ x: i, y: s.delivered })));
    const failRegression = linearRegression(recent12.map((s, i) => ({ x: i, y: s.failed })));

    const recentRev12 = historicalRevenue.slice(-12);
    const billedRegression = linearRegression(recentRev12.map((r, i) => ({ x: i, y: r.billed })));
    const collectedRegression = linearRegression(recentRev12.map((r, i) => ({ x: i, y: r.collected })));

    // Forecast
    const forecastShipments: { month: string; predicted: number; lower: number; upper: number }[] = [];
    const forecastRevenue: { month: string; predictedBilled: number; predictedCollected: number }[] = [];

    const lastIdx = recent12.length - 1;
    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = monthKey(futureDate);
      const x = lastIdx + i;
      const shipPred = Math.max(0, Math.round(shipRegression.slope * x + shipRegression.intercept));
      const failPred = Math.max(0, Math.round(failRegression.slope * x + failRegression.intercept));
      const residual = recent12.reduce((s, r, j) => s + (r.delivered - (shipRegression.slope * j + shipRegression.intercept)) ** 2, 0) / recent12.length;
      const stdErr = Math.sqrt(residual);
      forecastShipments.push({ month: key, predicted: shipPred, lower: Math.max(0, Math.round(shipPred - 1.96 * stdErr)), upper: Math.round(shipPred + 1.96 * stdErr) });
      forecastRevenue.push({
        month: key,
        predictedBilled: Math.max(0, Math.round(billedRegression.slope * x + billedRegression.intercept)),
        predictedCollected: Math.max(0, Math.round(collectedRegression.slope * x + collectedRegression.intercept)),
      });
    }

    const latestShipments = recent12[recent12.length - 1]?.delivered || 0;
    const forecastNextMonth = forecastShipments[0]?.predicted || 0;
    const growthPct = latestShipments > 0 ? ((forecastNextMonth - latestShipments) / latestShipments * 100) : 0;

    return NextResponse.json({
      historical: { shipments: historicalShipments, revenue: historicalRevenue },
      forecast: { shipments: forecastShipments, revenue: forecastRevenue },
      metrics: {
        shipmentR2: shipRegression.r2,
        revenueR2: billedRegression.r2,
        forecastGrowthPct: Math.round(growthPct * 10) / 10,
        currentMonthly: latestShipments,
        forecastMonthly: forecastNextMonth,
      },
    });
  });
}
