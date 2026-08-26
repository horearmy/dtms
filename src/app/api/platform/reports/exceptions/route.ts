import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { Prisma, ExceptionStatus } from '@prisma/client';

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
      return {
        from: fromStr ? new Date(fromStr) : startOfDay,
        to: toStr ? new Date(toStr) : now,
      };
    }
    case 'this_month':
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const period = parsePeriod(req.nextUrl.searchParams);
    const tenantFilter: Prisma.ExceptionWhereInput = session?.tenantId
      ? { tenantId: session.tenantId }
      : {};

    const periodFilter: Prisma.ExceptionWhereInput = {
      createdAt: { gte: period.from, lte: period.to },
    };

    const where = { ...tenantFilter, ...periodFilter };
    const openStatuses: ExceptionStatus[] = ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'];
    const openWhere = { ...tenantFilter, status: { in: openStatuses } };

    const [
      total,
      totalAllTime,
      byStatus,
      bySeverity,
      byType,
      byTenant,
      resolvedWithTime,
      agingOpen,
      recentTrend,
    ] = await Promise.all([
      prisma.exception.count({ where }),
      prisma.exception.count({ where: tenantFilter }),
      prisma.exception.groupBy({ by: ['status'], where, _count: true, orderBy: { _count: { status: 'desc' } } }),
      prisma.exception.groupBy({ by: ['severity'], where, _count: true }),
      prisma.exception.groupBy({ by: ['type'], where, _count: true, orderBy: { _count: { type: 'desc' } } }),
      prisma.exception.groupBy({
        by: ['tenantId'],
        where,
        _count: true,
        orderBy: { _count: { tenantId: 'desc' } },
        take: 10,
      }),
      prisma.exception.findMany({
        where: { ...tenantFilter, status: { in: ['RESOLVED', 'VERIFIED', 'CLOSED'] }, resolvedAt: { not: null }, createdAt: { gte: period.from, lte: period.to } },
        select: { createdAt: true, resolvedAt: true, type: true, severity: true },
        take: 5000,
      }),
      prisma.exception.findMany({
        where: { ...openWhere, OR: [{ dueAt: { lt: new Date() } }, { createdAt: { lte: new Date(Date.now() - 7 * 86400000) } }] },
        select: { id: true, title: true, type: true, severity: true, status: true, createdAt: true, dueAt: true, tenantId: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "Exception"
        WHERE "createdAt" >= ${period.from} AND "createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND "tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    const openCount = await prisma.exception.count({ where: openWhere });

    const resolutionTimesMs = resolvedWithTime.map((e) => e.resolvedAt!.getTime() - e.createdAt.getTime());
    const avgResolutionMs = resolutionTimesMs.length > 0 ? resolutionTimesMs.reduce((a, b) => a + b, 0) / resolutionTimesMs.length : 0;
    const sortedTimes = [...resolutionTimesMs].sort((a, b) => a - b);
    const medianResolutionMs = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResolutionMs = sortedTimes.length > 0 ? sortedTimes[p95Index] : 0;

    const fmtDuration = (ms: number) => {
      if (ms === 0) return '-';
      const hours = ms / 3600000;
      if (hours < 24) return `${hours.toFixed(1)} jam`;
      const days = hours / 24;
      return `${days.toFixed(1)} hari`;
    };

    const tenantNames = await prisma.tenant.findMany({
      where: { id: { in: byTenant.map((t) => t.tenantId) } },
      select: { id: true, name: true },
    });
    const tenantNameMap = new Map(tenantNames.map((t) => [t.id, t.name]));

    const tenantAgingNames = await prisma.tenant.findMany({
      where: { id: { in: agingOpen.map((e) => e.tenantId) } },
      select: { id: true, name: true },
    });
    const tenantAgingNameMap = new Map(tenantAgingNames.map((t) => [t.id, t.name]));

    const unresolved = total - (byStatus.find((s) => ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(s.status))?._count || 0);
    const resolutionRate = total > 0 ? ((total - unresolved) / total) * 100 : 100;

    const severityWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const weightedScore = bySeverity.reduce((sum, s) => sum + (severityWeight[s.severity] || 0) * s._count, 0);
    const maxPossibleScore = total * 4;
    const severityIndex = maxPossibleScore > 0 ? (weightedScore / maxPossibleScore) * 100 : 0;

    const insights: Array<{ type: string; text: string }> = [];

    if (resolutionRate < 80) {
      insights.push({ type: 'attention', text: `Resolution rate ${resolutionRate.toFixed(1)}% di bawah target 80%. ${unresolved} exception masih belum terselesaikan.` });
    }
    if (severityIndex > 60) {
      insights.push({ type: 'critical', text: `Severity index ${severityIndex.toFixed(0)}/100 — banyak exception berat. Prioritaskan CRITICAL dan HIGH.` });
    }
    if (agingOpen.length > 0) {
      insights.push({ type: 'attention', text: `${agingOpen.length} exception sudah overdue atau open >7 hari. Perlu eskalasi.` });
    }
    if (avgResolutionMs > 0) {
      insights.push({ type: 'info', text: `Rata-rata resolution time: ${fmtDuration(avgResolutionMs)}. Median: ${fmtDuration(medianResolutionMs)}.` });
    }

    return NextResponse.json({
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      summary: {
        total,
        totalAllTime,
        open: openCount,
        resolved: total - openCount,
        resolutionRate: Number(resolutionRate.toFixed(1)),
        severityIndex: Number(severityIndex.toFixed(0)),
        avgResolutionTime: fmtDuration(avgResolutionMs),
        medianResolutionTime: fmtDuration(medianResolutionMs),
        p95ResolutionTime: fmtDuration(p95ResolutionMs),
      },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      byTenant: byTenant.map((t) => ({ tenantId: t.tenantId, tenantName: tenantNameMap.get(t.tenantId) || t.tenantId, count: t._count })),
      aging: agingOpen.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        severity: e.severity,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
        dueAt: e.dueAt?.toISOString() || null,
        tenantName: tenantAgingNameMap.get(e.tenantId) || e.tenantId,
        daysOpen: Math.floor((Date.now() - e.createdAt.getTime()) / 86400000),
      })),
      trend: recentTrend.map((r) => ({ date: r.date.toISOString().split('T')[0], count: Number(r.count) })),
      insights,
    });
  });
}
