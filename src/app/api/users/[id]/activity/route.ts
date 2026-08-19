import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.USER.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, username: true, email: true, role: true, status: true,
        phone: true, mustChangePassword: true, lastPasswordChange: true, createdAt: true, tenantId: true,
        totpEnabled: true, provider: true,
        driver: { select: { id: true, employeeId: true, name: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    if (session.role !== 'SUPER_ADMIN' && user.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Tidak memiliki akses ke user ini' }, { status: 403 });
    }

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10));

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: { userId: id } }),
      prisma.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, action: true, module: true, oldData: true, newData: true,
          ip: true, method: true, path: true, createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({ user, logs, total, page, pageSize });
  });
}
