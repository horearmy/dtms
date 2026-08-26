import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const where = session?.tenantId ? { tenantId: session.tenantId } : {} as Record<string, any>;

    const schedules = await prisma.scheduledReport.findMany({
      where,
      include: { _count: { select: { jobs: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = schedules.map((s) => ({
      ...s,
      jobCount: s._count.jobs,
      lastJob: null as any,
    }));

    return NextResponse.json(enriched);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  const body = await req.json();
  const { name, reportType, dataset, dimension, metric, preset, format, schedule, timezone, recipients } = body;

  if (!name || !schedule) {
    return NextResponse.json({ error: 'name and schedule are required' }, { status: 400 });
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantId = session?.tenantId || null;

    const scheduleReport = await prisma.scheduledReport.create({
      data: {
        ...(tenantId ? { tenantId } : {}),
        name,
        reportType: reportType || 'custom',
        dataset: dataset || 'shipments',
        dimension: dimension || 'status',
        metric: metric || 'count',
        preset: preset || 'this_month',
        format: format || 'csv',
        schedule,
        timezone: timezone || 'Asia/Jakarta',
        recipients: recipients || [],
        active: true,
        nextRunAt: computeNextRun(schedule, timezone || 'Asia/Jakarta'),
      },
    });

    return NextResponse.json(scheduleReport, { status: 201 });
  });
}

function computeNextRun(schedule: string, _tz: string): Date {
  const now = new Date();
  const parts = schedule.split(' ');
  if (parts.length >= 2) {
    const freq = parts[0]?.toLowerCase();
    if (freq === 'daily') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(6, 0, 0, 0);
      return d;
    }
    if (freq === 'weekly') {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(6, 0, 0, 0);
      return d;
    }
    if (freq === 'monthly') {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(6, 0, 0, 0);
      return d;
    }
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(6, 0, 0, 0);
  return d;
}
