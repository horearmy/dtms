import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

function isOwner(schedule: { tenantId: string | null }, sessionTenantId: string | null, role: string): boolean {
  if (role === 'SUPER_ADMIN') return true;
  return schedule.tenantId === sessionTenantId;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;
  const { id } = await params;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const schedule = await prisma.scheduledReport.findUnique({
      where: { id },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isOwner(schedule, session?.tenantId ?? null, session?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(schedule);
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;
  const { id } = await params;

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const existing = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isOwner(existing, session?.tenantId ?? null, session?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.scheduledReport.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        schedule: body.schedule ?? existing.schedule,
        timezone: body.timezone ?? existing.timezone,
        format: body.format ?? existing.format,
        recipients: body.recipients ?? existing.recipients,
        active: body.active ?? existing.active,
        dataset: body.dataset ?? existing.dataset,
        dimension: body.dimension ?? existing.dimension,
        metric: body.metric ?? existing.metric,
        preset: body.preset ?? existing.preset,
      },
    });

    logAudit(session, 'UPDATE_SCHEDULE', 'report_schedule', { oldData: { id }, newData: body }, req);

    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;
  const { id } = await params;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const existing = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!isOwner(existing, session?.tenantId ?? null, session?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.scheduledReport.delete({ where: { id } });
    logAudit(session, 'DELETE_SCHEDULE', 'report_schedule', { oldData: { id } }, _req);
    return NextResponse.json({ ok: true });
  });
}
