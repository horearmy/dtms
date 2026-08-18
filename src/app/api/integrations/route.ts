// src/app/api/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.READ);
  if (error) return error;

  const integrations = await prisma.integrationConfig.findMany({
    where: session?.tenantId ? { tenantId: session.tenantId } : {},
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(integrations.map((i) => ({
    id: i.id, name: i.name, type: i.type, baseUrl: i.baseUrl, active: i.active, createdAt: i.createdAt,
  })));
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.CREATE);
  if (error) return error;

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
