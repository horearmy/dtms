import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(_req: NextRequest) {
  const { error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW, 'SUPER_ADMIN');
  if (error) return error;

  return runWithTenant(null, async () => {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;

    const [
      dbTenantCount,
      dbUserCount,
      dbDriverCount,
      dbVehicleCount,
      dbShipmentCount,
      dbCustomerCount,
      dbIntegrationLogCount,
      dbGpsLogCount,
      dbAuditLogCount,
      dbNotificationCount,
      currentAuditTotal,
      currentAuditErrors,
      prevAuditTotal,
      prevAuditErrors,
      webhookDelivered,
      webhookFailed,
      activeIntegrations,
      activeWebhooks,
      activeApiKeys,
      recentErrors,
      hourlyRequests,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.driver.count(),
      prisma.vehicle.count(),
      prisma.shipment.count(),
      prisma.customer.count(),
      prisma.integrationLog.count(),
      prisma.gpsLog.count(),
      prisma.auditLog.count(),
      prisma.notification.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(now - hour) } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(now - hour) }, action: { contains: 'FAILED' } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(now - hour * 2), lt: new Date(now - hour) } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(now - hour * 2), lt: new Date(now - hour) }, action: { contains: 'FAILED' } } }),
      prisma.webhookDelivery.count({ where: { createdAt: { gte: new Date(now - day) }, status: 'DELIVERED' } }),
      prisma.webhookDelivery.count({ where: { createdAt: { gte: new Date(now - day) }, status: { in: ['FAILED', 'PENDING'] } } }),
      prisma.integrationConfig.count({ where: { active: true } }),
      prisma.webhookSubscription.count({ where: { active: true } }),
      prisma.apiKey.count({ where: { active: true } }),
      prisma.integrationLog.findMany({
        where: { createdAt: { gte: new Date(now - day) }, OR: [{ statusCode: { gte: 500 } }, { error: { not: null } }] },
        select: { id: true, direction: true, method: true, path: true, statusCode: true, error: true, durationMs: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('hour', "createdAt") as hour, COUNT(*) as count
        FROM "AuditLog"
        WHERE "createdAt" >= ${new Date(now - 24 * hour)} AND "createdAt" <= ${new Date(now)}
        GROUP BY DATE_TRUNC('hour', "createdAt")
        ORDER BY hour ASC
      `,
    ]);

    const currentSuccessRate = currentAuditTotal > 0 ? ((currentAuditTotal - currentAuditErrors) / currentAuditTotal) * 100 : 100;
    const prevSuccessRate = prevAuditTotal > 0 ? ((prevAuditTotal - prevAuditErrors) / prevAuditTotal) * 100 : 100;
    const successTrend = currentSuccessRate - prevSuccessRate;

    const webhookTotal = webhookDelivered + webhookFailed;
    const webhookSuccessRate = webhookTotal > 0 ? (webhookDelivered / webhookTotal) * 100 : 100;

    const totalRequests = currentAuditTotal + webhookTotal;
    const totalErrors = currentAuditErrors + webhookFailed;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    const dbStats = [
      { name: 'Tenants', count: dbTenantCount },
      { name: 'Users', count: dbUserCount },
      { name: 'Drivers', count: dbDriverCount },
      { name: 'Vehicles', count: dbVehicleCount },
      { name: 'Shipments', count: dbShipmentCount },
      { name: 'Customers', count: dbCustomerCount },
      { name: 'Integration Logs', count: dbIntegrationLogCount },
      { name: 'GPS Logs', count: dbGpsLogCount },
      { name: 'Audit Logs', count: dbAuditLogCount },
      { name: 'Notifications', count: dbNotificationCount },
    ];

    const insights: Array<{ type: string; text: string }> = [];

    if (currentSuccessRate < 95) {
      insights.push({ type: 'critical', text: `API success rate ${currentSuccessRate.toFixed(1)}% — di bawah threshold 95%. Perlu investigation.` });
    }
    if (errorRate > 5) {
      insights.push({ type: 'attention', text: `Error rate ${errorRate.toFixed(1)}% — melebihi threshold 5%. ${totalErrors} errors dari ${totalRequests} requests.` });
    }
    if (successTrend < -5) {
      insights.push({ type: 'attention', text: `Success rate turun ${Math.abs(successTrend).toFixed(1)}% dari jam sebelumnya.` });
    }
    if (currentSuccessRate >= 99) {
      insights.push({ type: 'positive', text: `System health excellent — success rate ${currentSuccessRate.toFixed(1)}%.` });
    }
    if (webhookFailed > 0) {
      insights.push({ type: 'attention', text: `${webhookFailed} webhook gagal dalam 24 jam terakhir.` });
    }

    return NextResponse.json({
      api: {
        successRate: Number(currentSuccessRate.toFixed(1)),
        prevSuccessRate: Number(prevSuccessRate.toFixed(1)),
        successTrend: Number(successTrend.toFixed(1)),
        requestsLastHour: currentAuditTotal,
        errorsLastHour: currentAuditErrors,
        errorRate: Number(errorRate.toFixed(1)),
      },
      webhook: {
        successRate: Number(webhookSuccessRate.toFixed(1)),
        delivered24h: webhookDelivered,
        failed24h: webhookFailed,
        total24h: webhookTotal,
      },
      infrastructure: {
        activeIntegrations,
        activeWebhooks,
        activeApiKeys,
      },
      database: dbStats,
      recentErrors: recentErrors.map((e) => ({
        id: e.id, direction: e.direction, method: e.method, path: e.path,
        statusCode: e.statusCode, error: e.error, durationMs: e.durationMs,
        createdAt: e.createdAt.toISOString(),
      })),
      hourlyTrend: hourlyRequests.map((r) => ({ hour: r.hour.toISOString(), count: Number(r.count) })),
      insights,
    });
  });
}
