import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const tenantId = req.nextUrl.searchParams.get('tenantId') || session.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'tenantId wajib' }, { status: 400 });

  const orgs = await prisma.organization.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { regions: true, branches: true } },
    },
  });

  return NextResponse.json(orgs);
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
    const existing = await prisma.organization.findFirst({ where: { tenantId, code: body.code } });
    if (existing) return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 409 });
  }

  const org = await prisma.organization.create({
    data: {
      tenantId,
      name: String(body.name).slice(0, 100),
      code: body.code ? String(body.code).slice(0, 20) : null,
      description: body.description ? String(body.description).slice(0, 500) : null,
      logoUrl: body.logoUrl || null,
      active: body.active !== false,
    },
  });

  return NextResponse.json(org, { status: 201 });
}
