import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

type TenantRisk = {
  tenantId: string;
  tenantName: string;
  plan: string;
  overallScore: number;
  riskLevel: RiskLevel;
  factors: {
    category: string;
    score: number;
    label: string;
    detail: string;
  }[];
  recommendation: string;
};

function riskLevel(score: number): RiskLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  return 'MINIMAL';
}

function riskColor(level: RiskLevel): string {
  const m: Record<RiskLevel, string> = { CRITICAL: '#F5222D', HIGH: '#FF8A00', MEDIUM: '#0D6EFD', LOW: '#16B364', MINIMAL: '#667085' };
  return m[level];
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const where = session?.tenantId ? { tenantId: session.tenantId } as Record<string, any> : {} as Record<string, any>;
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } as Record<string, any> : {} as Record<string, any>;

    const tenants = await prisma.tenant.findMany({
      where: tenantFilter,
      select: {
        id: true, name: true, plan: true, status: true, maxUsers: true, maxDrivers: true, maxShipments: true,
        _count: { select: { users: true, drivers: true, customers: true, shipments: true } },
      },
      orderBy: { name: 'asc' },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
    const now = new Date();

    const tenantIds = tenants.map((t) => t.id);

    const [overdueInvoices, breachedSla, failedShipments, openExceptions, currentShipments, prevShipments] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, status: 'OVERDUE' },
        _count: true,
        _sum: { total: true },
      }),
      prisma.slaEvent.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, status: 'BREACHED', createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      prisma.shipment.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, status: 'DELIVERY_FAILED', createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      prisma.exception.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] as any } },
        _count: true,
      }),
      prisma.shipment.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      prisma.shipment.groupBy({
        by: ['tenantId'],
        where: { tenantId: { in: tenantIds }, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _count: true,
      }),
    ]);

    const overdueMap = new Map(overdueInvoices.map((o) => [o.tenantId, { count: o._count, total: Number(o._sum.total || 0) }]));
    const breachedMap = new Map(breachedSla.map((b) => [b.tenantId, b._count]));
    const failedMap = new Map(failedShipments.map((f) => [f.tenantId, f._count]));
    const exceptionMap = new Map(openExceptions.map((e) => [e.tenantId, e._count]));
    const currentMap = new Map(currentShipments.map((s) => [s.tenantId, s._count]));
    const prevMap = new Map(prevShipments.map((s) => [s.tenantId, s._count]));

    const risks: TenantRisk[] = tenants.map((t) => {
      const factors: TenantRisk['factors'] = [];

      const overdue = overdueMap.get(t.id);
      const financialScore = overdue ? Math.min(overdue.count * 15 + (overdue.total > 0 ? 20 : 0), 50) : 0;
      if (financialScore > 0) {
        factors.push({ category: 'Financial', score: financialScore, label: `${overdue?.count || 0} invoice overdue`, detail: overdue ? `Total overdue: Rp ${(overdue.total / 1_000_000).toFixed(1)}M` : '-' });
      }

      const breached = breachedMap.get(t.id) || 0;
      const failed = failedMap.get(t.id) || 0;
      const current = currentMap.get(t.id) || 0;
      const slaScore = current > 0 ? Math.min(Math.round(((breached + failed) / Math.max(current, 1)) * 100), 40) : 0;
      if (breached > 0 || failed > 0) {
        factors.push({ category: 'Operational', score: slaScore, label: `${breached} SLA breached, ${failed} failed`, detail: `${breached} shipment melanggar SLA, ${failed} pengiriman gagal` });
      }

      const exceptions = exceptionMap.get(t.id) || 0;
      const exceptionScore = Math.min(exceptions * 8, 30);
      if (exceptions > 0) {
        factors.push({ category: 'Exception', score: exceptionScore, label: `${exceptions} open exceptions`, detail: `${exceptions} exception belum tertutup` });
      }

      const maxShipment = t.maxShipments > 0 ? t.maxShipments : 10000;
      const usagePct = (current / maxShipment) * 100;
      const capacityScore = usagePct > 80 ? Math.min(Math.round((usagePct - 80) * 1.5), 20) : 0;
      if (capacityScore > 0) {
        factors.push({ category: 'Capacity', score: capacityScore, label: `Usage ${usagePct.toFixed(0)}%`, detail: `${current} shipment dari ${maxShipment} limit` });
      }

      const prev = prevMap.get(t.id) || 0;
      const volumeDrop = prev > 0 ? ((prev - current) / prev) * 100 : 0;
      const churnScore = volumeDrop > 30 ? Math.min(Math.round(volumeDrop / 2), 25) : volumeDrop > 20 ? Math.round(volumeDrop / 4) : 0;
      if (churnScore > 0) {
        factors.push({ category: 'Churn Risk', score: churnScore, label: `Volume turun ${volumeDrop.toFixed(0)}%`, detail: `Dari ${prev} ke ${current} shipment per 30 hari` });
      }

      const overallScore = Math.min(factors.reduce((s, f) => s + f.score, 0), 100);
      const level = riskLevel(overallScore);

      let recommendation = 'Tidak ada tindakan yang diperlukan.';
      if (level === 'CRITICAL') recommendation = 'Perlu perhatian segera. Hubungi tenant untuk follow-up operasional dan billing.';
      else if (level === 'HIGH') recommendation = 'Monitor secara aktif. Pertimbangkan outreach untuk mendukung peningkatan performa.';
      else if (level === 'MEDIUM') recommendation = 'Pantau secara berkala. Kirim laporan performa bulanan.';
      else if (level === 'LOW') recommendation = 'Tenant dalam kondisi baik. Pertahankan komunikasi rutin.';

      return { tenantId: t.id, tenantName: t.name, plan: t.plan, overallScore, riskLevel: level, factors, recommendation };
    });

    risks.sort((a, b) => b.overallScore - a.overallScore);

    const summary = {
      total: tenants.length,
      critical: risks.filter((r) => r.riskLevel === 'CRITICAL').length,
      high: risks.filter((r) => r.riskLevel === 'HIGH').length,
      medium: risks.filter((r) => r.riskLevel === 'MEDIUM').length,
      low: risks.filter((r) => r.riskLevel === 'LOW').length,
      minimal: risks.filter((r) => r.riskLevel === 'MINIMAL').length,
    };

    return NextResponse.json({ risks, summary, riskColor });
  });
}
