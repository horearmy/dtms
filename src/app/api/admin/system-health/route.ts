import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guardPermission('*');
  if (error) return error;
  return runWithTenant(null, async () => {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const currentStart = new Date(now - windowMs);
    const prevStart = new Date(now - windowMs * 2);

    const [
      currentAuditTotal,
      currentAuditErrors,
      prevAuditTotal,
      prevAuditErrors,
      webhookDelivered,
      webhookFailed,
      integrationErrors,
      activeIntegrations,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { gte: currentStart } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: currentStart }, action: { contains: 'FAILED' } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: prevStart, lt: currentStart } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: prevStart, lt: currentStart }, action: { contains: 'FAILED' } } }),
      prisma.webhookDelivery.count({ where: { createdAt: { gte: currentStart }, status: 'DELIVERED' } }),
      prisma.webhookDelivery.count({ where: { createdAt: { gte: currentStart }, status: { in: ['FAILED', 'PENDING'] } } }),
      prisma.integrationLog.count({ where: { createdAt: { gte: currentStart }, error: { not: null } } }),
      prisma.integrationConfig.count({ where: { active: true } }),
    ]);

    const currentSuccessTotal = currentAuditTotal || 1;
    const prevSuccessTotal = prevAuditTotal || 1;
    const apiSuccessRate = Math.round(((currentAuditTotal - currentAuditErrors) / currentSuccessTotal) * 100);
    const prevApiSuccessRate = Math.round(((prevAuditTotal - prevAuditErrors) / prevSuccessTotal) * 100);
    const apiSuccessTrend = apiSuccessRate - prevApiSuccessRate;

    const webhookTotal = webhookDelivered + webhookFailed;
    const webhookSuccessRate = webhookTotal > 0 ? Math.round((webhookDelivered / webhookTotal) * 100) : 100;

    const totalRequests = currentAuditTotal + webhookTotal + integrationErrors;
    const totalErrors = currentAuditErrors + webhookFailed + integrationErrors;
    const errorRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0;

    const errorTrend = currentAuditErrors - prevAuditErrors;

    return NextResponse.json({
      apiSuccessRate,
      apiSuccessTrend,
      webhookSuccessRate,
      errorRate,
      errorTrend,
      currentRequests: currentAuditTotal,
      currentErrors: currentAuditErrors,
      activeIntegrations,
      details: {
        auditTotal: currentAuditTotal,
        auditErrors: currentAuditErrors,
        webhookDelivered,
        webhookFailed,
        integrationErrors,
      },
    });
  });
}
