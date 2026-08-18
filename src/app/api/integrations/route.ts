// src/app/api/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard, guardPermission } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;
  const perm = await guardPermission('settings.view');
  if (perm.error) return perm.error;

  const integrations = await prisma.integrationConfig.findMany({
    where: session?.tenantId ? { tenantId: session.tenantId } : {},
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(integrations.map((i) => ({
    id: i.id, name: i.name, type: i.type, baseUrl: i.baseUrl, active: i.active, createdAt: i.createdAt,
  })));
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;
  const perm = await guardPermission('settings.edit');
  if (perm.error) return perm.error;

  const body = await req.json();
  const integration = await prisma.integrationConfig.create({
    data: {
      tenantId: session!.tenantId!,
      name: body.name,
      type: body.type || 'REST_API',
      baseUrl: body.baseUrl || null,
      config: body.config || undefined,
    },
  });

  return NextResponse.json(integration, { status: 201 });
}
