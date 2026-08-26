import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

const triggerRateMap = new Map<string, number>();
const TRIGGER_COOLDOWN_MS = 60_000;

setInterval(() => triggerRateMap.clear(), 5 * 60_000);

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { session, error } = await guardPermission(PERMISSIONS.REPORT.EXPORT);
  if (error) return error;
  const { id } = await params;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const rateKey = `${session?.id}:${id}`;
    const lastTrigger = triggerRateMap.get(rateKey) ?? 0;
    if (Date.now() - lastTrigger < TRIGGER_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Trigger rate limit exceeded. Try again later.' }, { status: 429 });
    }

    const schedule = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session?.role !== 'SUPER_ADMIN' && schedule.tenantId !== session?.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const recentJobs = await prisma.reportJob.count({
      where: { scheduledReportId: id, createdAt: { gte: new Date(Date.now() - TRIGGER_COOLDOWN_MS) } },
    });
    if (recentJobs > 0) {
      return NextResponse.json({ error: 'Schedule already triggered recently' }, { status: 429 });
    }

    triggerRateMap.set(rateKey, Date.now());

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

    await prisma.reportJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    await prisma.reportJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', completedAt: new Date(), fileUrl: `/api/platform/reports/export?type=${schedule.dataset}&limit=500` },
    });

    await prisma.scheduledReport.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    logAudit(session, 'TRIGGER_SCHEDULE', 'report_schedule', { newData: { id, jobId: job.id } }, _req);

    return NextResponse.json(job);
  });
}
