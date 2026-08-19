import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.NOTIFICATION.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const isSuperAdmin = session!.role === 'SUPER_ADMIN';
    const tenantId = req.nextUrl.searchParams.get('tenantId') || undefined;
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10));

    const where: Record<string, unknown> = {};

    if (isSuperAdmin) {
      if (tenantId) {
        where.tenantId = tenantId;
      }
    } else {
      where.tenantId = session!.tenantId;
    }

    const [total, items, unreadCount] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.message.count({
        where: { ...where, read: false, direction: isSuperAdmin ? 'INBOUND' : 'OUTBOUND' },
      }),
    ]);

    return NextResponse.json({ items, total, unreadCount, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.NOTIFICATION.SEND);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const isSuperAdmin = session!.role === 'SUPER_ADMIN';
    const body = await req.json();
    const { tenantId, subject, body: messageBody, direction } = body;

    if (!subject || !messageBody) {
      return NextResponse.json({ error: 'Subjek dan pesan wajib diisi' }, { status: 400 });
    }

    let targetTenantId = tenantId;
    if (!isSuperAdmin) {
      targetTenantId = session!.tenantId;
    }

    if (!targetTenantId) {
      return NextResponse.json({ error: 'Tenant tidak valid' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true } });
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
    }

    const msgDirection = isSuperAdmin ? (direction || 'OUTBOUND') : 'INBOUND';

    const msg = await prisma.message.create({
      data: {
        tenantId: targetTenantId,
        subject,
        body: messageBody,
        senderId: session!.id,
        senderName: session!.name,
        direction: msgDirection,
      },
    });

    const tenantAdmins = await prisma.user.findMany({
      where: { tenantId: targetTenantId, role: { in: ['SUPER_ADMIN', 'ADMIN_OPERASIONAL'] } },
      select: { id: true },
    });
    if (tenantAdmins.length > 0) {
      await prisma.notification.createMany({
        data: tenantAdmins.map((u) => ({
          userId: u.id,
          message: `[Pesan] ${subject}`,
        })),
      });
    }

    return NextResponse.json(msg);
  });
}
