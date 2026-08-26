import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;
  const { id } = await params;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const schedule = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const job = await prisma.reportJob.create({
      data: {
        tenantId: schedule.tenantId,
        scheduledReportId: schedule.id,
        reportType: schedule.reportType,
        parameters: { dataset: schedule.dataset, dimension: schedule.dimension, metric: schedule.metric, preset: schedule.preset },
        format: schedule.format,
        status: 'QUEUED',
        requestedBy: session?.id || 'system',
      },
    });

    // Simulate job processing (in production, this would go to a queue/worker)
    await prisma.reportJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    // For now, mark as completed immediately (CSV generation would happen async in production)
    await prisma.reportJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date(), fileUrl: `/api/platform/reports/export?type=${schedule.dataset}&limit=500` },
    });

    await prisma.scheduledReport.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    return NextResponse.json(job);
  });
}
