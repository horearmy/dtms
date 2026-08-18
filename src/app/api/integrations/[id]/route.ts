// src/app/api/integrations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.READ);
  if (error) return error;
  const { id } = await params;

  const integration = await prisma.integrationConfig.findFirst({
    where: { id, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 50 }, webhooks: true },
  });

  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(integration);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.UPDATE);
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  const integration = await prisma.integrationConfig.updateMany({
    where: { id, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) },
    data: { name: body.name, baseUrl: body.baseUrl, active: body.active, config: body.config },
  });

  return NextResponse.json(integration);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.DELETE);
  if (error) return error;
  const { id } = await params;

  await prisma.integrationConfig.deleteMany({
    where: { id, ...(session?.tenantId ? { tenantId: session.tenantId } : {}) },
  });

  return NextResponse.json({ ok: true });
}
