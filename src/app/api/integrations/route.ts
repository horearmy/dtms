// src/app/api/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const integrations = await prisma.integrationConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(integrations.map((i) => ({
      id: i.id, name: i.name, type: i.type, baseUrl: i.baseUrl, active: i.active, createdAt: i.createdAt,
    })));
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.INTEGRATION.CREATE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const name = body.name?.toString().trim().slice(0, 100);
    if (!name) {
      return NextResponse.json({ error: 'Nama integrasi wajib diisi' }, { status: 400 });
    }
    const baseUrl = body.baseUrl?.toString().trim().slice(0, 500) || null;
    if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
      return NextResponse.json({ error: 'URL harus menggunakan http:// atau https://' }, { status: 400 });
    }
    const config = body.config && typeof body.config === 'object' ? JSON.parse(JSON.stringify(body.config)) : undefined;
    const integration = await prisma.integrationConfig.create({
      data: {
        tenantId: session!.tenantId!,
        name,
        type: body.type?.toString().trim() || 'REST_API',
        baseUrl,
        config,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  });
}
