import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const tenantId = req.nextUrl.searchParams.get('tenantId') || session.tenantId;
  const orgId = req.nextUrl.searchParams.get('organizationId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });

  const where: Record<string, unknown> = { tenantId };
  if (orgId) where.organizationId = orgId;

  const regions = await prisma.region.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      organization: { select: { id: true, name: true, code: true } },
      _count: { select: { branches: true } },
    },
  });

  return NextResponse.json(regions);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const body = await req.json();
  const tenantId = body.tenantId || session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

  if (body.code) {
    const existing = await prisma.region.findFirst({ where: { tenantId, code: body.code } });
    if (existing) return NextResponse.json({ error: 'Kode region sudah digunakan' }, { status: 409 });
  }

  const region = await prisma.region.create({
    data: {
      tenantId,
      organizationId: body.organizationId || null,
      name: String(body.name).slice(0, 100),
      code: body.code ? String(body.code).slice(0, 20) : null,
      description: body.description ? String(body.description).slice(0, 500) : null,
      latitude: body.latitude ? Number(body.latitude) : null,
      longitude: body.longitude ? Number(body.longitude) : null,
      active: body.active !== false,
    },
    include: { organization: { select: { id: true, name: true, code: true } } },
  });

  return NextResponse.json(region, { status: 201 });
}
