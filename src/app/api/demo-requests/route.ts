import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, runWithTenant } from '@/lib/api-guard';
import { provisionTenant } from '@/lib/provisioning';

export async function GET(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
    const q = req.nextUrl.searchParams.get('q') || '';
    const status = req.nextUrl.searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [total, items] = await Promise.all([
      prisma.demoRequest.count({ where }),
      prisma.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { tenant: { select: { id: true, slug: true, name: true } } },
      }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  });
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'id dan status wajib diisi' }, { status: 400 });
    }
    const allowed = ['PENDING', 'CONTACTED', 'COMPLETED', 'REJECTED'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: `Status harus salah satu dari: ${allowed.join(', ')}` }, { status: 400 });
    }

    const existing = await prisma.demoRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    if (existing.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Sudah diproses sebelumnya' }, { status: 400 });
    }

    if (status === 'COMPLETED' && !existing.tenantId) {
      try {
        await prisma.demoRequest.update({ where: { id }, data: { status: 'COMPLETED' } });
        const result = await provisionTenant(id);

        await prisma.notification.createMany({
          data: {
            userId: session!.id,
            message: `Tenant "${result.tenantName}" berhasil dibuat. Slug: ${result.slug}, Admin: ${result.adminUsername}`,
          },
        });

        const updated = await prisma.demoRequest.findUnique({
          where: { id },
          include: { tenant: { select: { id: true, slug: true, name: true } } },
        });

        return NextResponse.json({
          ...updated,
          provisioning: {
            slug: result.slug,
            adminUsername: result.adminUsername,
            adminPassword: result.adminPassword,
          },
        });
      } catch (err) {
        return NextResponse.json(
          { error: `Gagal provisioning: ${err instanceof Error ? err.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    const updated = await prisma.demoRequest.update({ where: { id }, data: { status } });
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    await prisma.demoRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
