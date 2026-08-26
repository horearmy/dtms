import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type Anomaly = {
  id: string;
  metric: string;
  dimension: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  detectedAt: string;
  period: string;
};

function monthKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function detectAnomalies(data: { month: string; value: number }[], metric: string, dimension: string): Anomaly[] {
  if (data.length < 3) return [];
  const values = data.map((d) => d.value);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  const anomalies: Anomaly[] = [];

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (stdDev === 0) continue;
    const zScore = (d.value - mean) / stdDev;
    if (Math.abs(zScore) > 1.5) {
      const deviation = Math.round(((d.value - mean) / mean) * 100);
      let severity: Anomaly['severity'] = 'LOW';
      if (Math.abs(zScore) > 3) severity = 'CRITICAL';
      else if (Math.abs(zScore) > 2.5) severity = 'HIGH';
      else if (Math.abs(zScore) > 2) severity = 'MEDIUM';

      const direction = zScore > 0 ? 'naik' : 'turun';
      anomalies.push({
        id: `anomaly_${metric}_${dimension}_${i}`,
        metric, dimension,
        expectedValue: Math.round(mean),
        actualValue: d.value,
        deviation,
        severity,
        description: `${metric} ${direction} ${Math.abs(deviation)}% dari rata-rata (${d.month})`,
        detectedAt: new Date().toISOString(),
        period: d.month,
      });
    }
  }
  return anomalies;
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const MAX_RECORDS = 50000;

    const shipments = await prisma.shipment.findMany({
      where: { ...tenantFilter, createdAt: { gte: startDate } },
      select: { createdAt: true, status: true },
      take: MAX_RECORDS,
    });

    const exceptions = await prisma.exception.findMany({
      where: { ...tenantFilter, createdAt: { gte: startDate } },
      select: { createdAt: true, severity: true },
      take: MAX_RECORDS,
    });

    const invoices = await prisma.invoice.findMany({
      where: { ...tenantFilter, createdAt: { gte: startDate }, status: { not: 'VOID' } },
      select: { createdAt: true, total: true },
      take: MAX_RECORDS,
    });

    const integrationLogs = await prisma.integrationLog.findMany({
      where: tenantFilter.tenantId
        ? { integrationConfig: { tenantId: tenantFilter.tenantId }, createdAt: { gte: startDate } }
        : { createdAt: { gte: startDate } },
      select: { createdAt: true, error: true },
      take: MAX_RECORDS,
    });

    // Aggregate by month
    const shipByMonth = new Map<string, number>();
    const failedByMonth = new Map<string, number>();
    const exceptByMonth = new Map<string, number>();
    const critExceptByMonth = new Map<string, number>();
    const revenueByMonth = new Map<string, number>();
    const errorLogsByMonth = new Map<string, number>();

    for (const s of shipments) {
      const k = monthKey(s.createdAt);
      shipByMonth.set(k, (shipByMonth.get(k) || 0) + 1);
      if (s.status === 'DELIVERY_FAILED') failedByMonth.set(k, (failedByMonth.get(k) || 0) + 1);
    }
    for (const e of exceptions) {
      const k = monthKey(e.createdAt);
      exceptByMonth.set(k, (exceptByMonth.get(k) || 0) + 1);
      if (e.severity === 'CRITICAL') critExceptByMonth.set(k, (critExceptByMonth.get(k) || 0) + 1);
    }
    for (const inv of invoices) {
      const k = monthKey(inv.createdAt);
      revenueByMonth.set(k, (revenueByMonth.get(k) || 0) + Number(inv.total));
    }
    for (const log of integrationLogs) {
      const k = monthKey(log.createdAt);
      if (log.error) errorLogsByMonth.set(k, (errorLogsByMonth.get(k) || 0) + 1);
    }

    // Build month series
    const months: string[] = [];
    const d = new Date(startDate);
    while (d <= now) { months.push(monthKey(d)); d.setMonth(d.getMonth() + 1); }

    const allAnomalies: Anomaly[] = [
      ...detectAnomalies(months.map((m) => ({ month: m, value: shipByMonth.get(m) || 0 })), 'Shipment Volume', 'total'),
      ...detectAnomalies(months.map((m) => ({ month: m, value: failedByMonth.get(m) || 0 })), 'Failed Deliveries', 'count'),
      ...detectAnomalies(months.map((m) => ({ month: m, value: exceptByMonth.get(m) || 0 })), 'Exceptions', 'count'),
      ...detectAnomalies(months.map((m) => ({ month: m, value: critExceptByMonth.get(m) || 0 })), 'Critical Exceptions', 'count'),
      ...detectAnomalies(months.map((m) => ({ month: m, value: revenueByMonth.get(m) || 0 })), 'Revenue', 'amount'),
      ...detectAnomalies(months.map((m) => ({ month: m, value: errorLogsByMonth.get(m) || 0 })), 'Integration Errors', 'count'),
    ];

    allAnomalies.sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });

    const summary = {
      total: allAnomalies.length,
      critical: allAnomalies.filter((a) => a.severity === 'CRITICAL').length,
      high: allAnomalies.filter((a) => a.severity === 'HIGH').length,
      medium: allAnomalies.filter((a) => a.severity === 'MEDIUM').length,
      low: allAnomalies.filter((a) => a.severity === 'LOW').length,
      byMetric: {
        shipmentVolume: allAnomalies.filter((a) => a.metric === 'Shipment Volume').length,
        failedDeliveries: allAnomalies.filter((a) => a.metric === 'Failed Deliveries').length,
        exceptions: allAnomalies.filter((a) => a.metric.includes('Exception')).length,
        revenue: allAnomalies.filter((a) => a.metric === 'Revenue').length,
        integrationErrors: allAnomalies.filter((a) => a.metric === 'Integration Errors').length,
      },
    };

    // Monthly data for charts
    const monthlyData = months.map((m) => ({
      month: m,
      shipments: shipByMonth.get(m) || 0,
      failed: failedByMonth.get(m) || 0,
      exceptions: exceptByMonth.get(m) || 0,
      revenue: revenueByMonth.get(m) || 0,
      integrationErrors: errorLogsByMonth.get(m) || 0,
    }));

    return NextResponse.json({ anomalies: allAnomalies, summary, monthlyData });
  });
}
