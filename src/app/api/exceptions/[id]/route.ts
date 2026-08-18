import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { broadcast } from '@/lib/sse-bus';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR');
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const { status, severity, ownerId, resolution } = body;

  const existing = await prisma.exception.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Exception tidak ditemukan' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === 'RESOLVED') data.resolvedAt = new Date();
    if (resolution) data.resolution = String(resolution).slice(0, 2000);
  }
  if (severity) data.severity = severity;
  if (ownerId !== undefined) data.ownerId = ownerId || null;

  const exception = await prisma.exception.update({ where: { id }, data });

  const channel = existing.tenantId ? `tenant:${existing.tenantId}` : 'global';
  broadcast(channel, 'exception:updated', {
    id: exception.id,
    status: exception.status,
    severity: exception.severity,
    updatedAt: exception.updatedAt.toISOString(),
  });
  broadcast(channel, 'control-tower:update', { type: 'exception' });

  return NextResponse.json(exception);
}
