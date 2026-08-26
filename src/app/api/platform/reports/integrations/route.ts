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
    const logWhere: Prisma.IntegrationLogWhereInput = session?.tenantId
      ? { integrationConfig: { tenantId: session.tenantId } }
      : {};
    const whWhere: Prisma.WebhookDeliveryWhereInput = session?.tenantId
      ? { subscription: { tenantId: session.tenantId } }
      : {};
    const keyWhere: Prisma.ApiKeyWhereInput = session?.tenantId
      ? { tenantId: session.tenantId }
      : {};

    const [
      totalLogs,
      logsByDirection,
      logsByStatusGroup,
      logsByIntegration,
      latencyResult,
      errorLogs,
      totalWebhooks,
      webhookByStatus,
      webhookSuccess,
      webhookFailed,
      totalApiKeys,
      activeApiKeys,
      expiredApiKeys,
      logsTrend,
    ] = await Promise.all([
      prisma.integrationLog.count({
        where: { ...logWhere, createdAt: { gte: period.from, lte: period.to } },
      }),
      prisma.integrationLog.groupBy({
        by: ['direction'],
        where: { ...logWhere, createdAt: { gte: period.from, lte: period.to } },
        _count: true,
      }),
      prisma.$queryRaw<{ statusGroup: string; count: bigint }[]>`
        SELECT
          CASE
            WHEN "statusCode" >= 200 AND "statusCode" < 300 THEN '2xx'
            WHEN "statusCode" >= 300 AND "statusCode" < 400 THEN '3xx'
            WHEN "statusCode" >= 400 AND "statusCode" < 500 THEN '4xx'
            WHEN "statusCode" >= 500 THEN '5xx'
            ELSE 'No Status'
          END as "statusGroup",
          COUNT(*) as count
        FROM "IntegrationLog"
        WHERE "createdAt" >= ${period.from} AND "createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND "integrationId" IN (SELECT id FROM "IntegrationConfig" WHERE "tenantId" = ${session.tenantId})` : Prisma.sql``}
        GROUP BY "statusGroup"
        ORDER BY count DESC
      `,
      prisma.$queryRaw<{ integrationId: string; name: string; count: bigint; errors: bigint; avgDuration: number }[]>`
        SELECT il."integrationId", ic.name, COUNT(*) as count,
          COUNT(CASE WHEN il."statusCode" >= 400 OR il.error IS NOT NULL THEN 1 END) as errors,
          COALESCE(AVG(il."durationMs"), 0) as "avgDuration"
        FROM "IntegrationLog" il
        JOIN "IntegrationConfig" ic ON ic.id = il."integrationId"
        WHERE il."createdAt" >= ${period.from} AND il."createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND ic."tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY il."integrationId", ic.name
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.integrationLog.aggregate({
        where: { ...logWhere, createdAt: { gte: period.from, lte: period.to }, durationMs: { not: null } },
        _avg: { durationMs: true },
        _max: { durationMs: true },
        _min: { durationMs: true },
      }),
      prisma.integrationLog.findMany({
        where: {
          ...logWhere,
          createdAt: { gte: period.from, lte: period.to },
          OR: [{ statusCode: { gte: 400 } }, { error: { not: null } }],
        },
        select: { id: true, direction: true, method: true, path: true, statusCode: true, error: true, durationMs: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.webhookDelivery.count({
        where: { ...whWhere, createdAt: { gte: period.from, lte: period.to } },
      }),
      prisma.webhookDelivery.groupBy({
        by: ['status'],
        where: { ...whWhere, createdAt: { gte: period.from, lte: period.to } },
        _count: true,
      }),
      prisma.webhookDelivery.count({
        where: { ...whWhere, createdAt: { gte: period.from, lte: period.to }, status: 'DELIVERED' },
      }),
      prisma.webhookDelivery.count({
        where: { ...whWhere, createdAt: { gte: period.from, lte: period.to }, status: 'FAILED' },
      }),
      prisma.apiKey.count({ where: keyWhere }),
      prisma.apiKey.count({ where: { ...keyWhere, active: true } }),
      prisma.apiKey.count({ where: { ...keyWhere, expiresAt: { lt: new Date() } } }),
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM "IntegrationLog"
        WHERE "createdAt" >= ${period.from} AND "createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND "integrationId" IN (SELECT id FROM "IntegrationConfig" WHERE "tenantId" = ${session.tenantId})` : Prisma.sql``}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    const successLogs = totalLogs - Number(logsByStatusGroup.find((g) => g.statusGroup === '4xx')?.count || 0)
      - Number(logsByStatusGroup.find((g) => g.statusGroup === '5xx')?.count || 0);
    const successRate = totalLogs > 0 ? (Number(successLogs) / totalLogs) * 100 : 99.9;
    const errorRate = totalLogs > 0 ? 100 - successRate : 0;

    const avgLatency = Number((latencyResult._avg.durationMs || 0).toFixed(0));
    const maxLatency = Number((latencyResult._max.durationMs || 0));
    const minLatency = Number((latencyResult._min.durationMs || 0));

    const webhookRate = totalWebhooks > 0 ? (webhookSuccess / totalWebhooks) * 100 : 100;

    const insights: Array<{ type: string; text: string }> = [];

    if (successRate < 95) {
      insights.push({ type: 'critical', text: `API success rate ${successRate.toFixed(1)}% — di bawah target 95%. Perlu investigation error.` });
    }
    if (avgLatency > 3000) {
      insights.push({ type: 'attention', text: `Avg latency ${avgLatency}ms — melebihi threshold 3 detik. Performance perlu dioptimasi.` });
    }
    if (webhookFailed > 0) {
      insights.push({ type: 'attention', text: `${webhookFailed} webhook delivery gagal. Retry atau manual investigation diperlukan.` });
    }
    if (expiredApiKeys > 0) {
      insights.push({ type: 'info', text: `${expiredApiKeys} API key sudah expired. Pertimbangkan rotasi key.` });
    }
    if (successRate >= 99) {
      insights.push({ type: 'positive', text: `API success rate ${successRate.toFixed(1)}% — excellent health.` });
    }

    return NextResponse.json({
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      summary: {
        totalLogs,
        successRate: Number(successRate.toFixed(1)),
        errorRate: Number(errorRate.toFixed(1)),
        avgLatencyMs: avgLatency,
        maxLatencyMs: maxLatency,
        minLatencyMs: minLatency,
      },
      byDirection: logsByDirection.map((d) => ({ direction: d.direction, count: d._count })),
      byStatusGroup: logsByStatusGroup.map((g) => ({ group: g.statusGroup, count: Number(g.count) })),
      byIntegration: logsByIntegration.map((i) => ({
        integrationId: i.integrationId, name: i.name,
        count: Number(i.count), errors: Number(i.errors),
        avgDurationMs: Number(Number(i.avgDuration).toFixed(0)),
      })),
      errors: errorLogs.map((e) => ({
        id: e.id, direction: e.direction, method: e.method, path: e.path,
        statusCode: e.statusCode, error: e.error, durationMs: e.durationMs,
        createdAt: e.createdAt.toISOString(),
      })),
      webhook: {
        total: totalWebhooks,
        success: webhookSuccess,
        failed: webhookFailed,
        successRate: Number(webhookRate.toFixed(1)),
        byStatus: webhookByStatus.map((s) => ({ status: s.status, count: s._count })),
      },
      apiKeys: {
        total: totalApiKeys,
        active: activeApiKeys,
        expired: expiredApiKeys,
      },
      trend: logsTrend.map((t) => ({ date: t.date.toISOString().split('T')[0], count: Number(t.count) })),
      insights,
    });
  });
}
