import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      regions: { include: { _count: { select: { branches: true } } } },
      branches: { include: { _count: { select: { users: true, warehouses: true, hubs: true } } } },
      _count: { select: { regions: true, branches: true } },
    },
  });

  if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });
  return NextResponse.json(org);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).slice(0, 100);
  if (body.code !== undefined) data.code = body.code ? String(body.code).slice(0, 20) : null;
  if (body.description !== undefined) data.description = body.description ? String(body.description).slice(0, 500) : null;
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;
  if (body.active !== undefined) data.active = Boolean(body.active);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
  }

  const updated = await prisma.organization.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: 'Organization tidak ditemukan' }, { status: 404 });

  const hasBranches = await prisma.branch.count({ where: { organizationId: id } });
  if (hasBranches > 0) {
    return NextResponse.json({ error: 'Tidak bisa menghapus organization yang masih memiliki branch' }, { status: 409 });
  }

  await prisma.organization.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: 'Organization berhasil dihapus' });
}
