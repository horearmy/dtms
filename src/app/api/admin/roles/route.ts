import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

const ALL_ROLES = [
  'SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE',
  'SUPERVISOR', 'MANAGEMENT', 'CUSTOMER_SERVICE', 'DRIVER', 'CUSTOMER',
] as const;

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.USER.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const [allPerms, rolePerms, userCounts] = await Promise.all([
      prisma.permission.findMany({ orderBy: { resource: 'asc' } }),
      prisma.rolePermission.findMany({
        where: session?.role === 'SUPER_ADMIN' ? {} : { tenantId: session?.tenantId },
        include: { permission: { select: { code: true, resource: true, action: true, label: true } } },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        where: session?.role === 'SUPER_ADMIN' ? {} : { tenantId: session?.tenantId },
      }),
    ]);

    const userCountMap = new Map<string, number>();
    for (const uc of userCounts) userCountMap.set(uc.role, uc._count.id);

    const grouped: Record<string, { code: string; resource: string; action: string; label: string | null }[]> = {};
    for (const p of allPerms) {
      if (!grouped[p.resource]) grouped[p.resource] = [];
      grouped[p.resource].push({ code: p.code, resource: p.resource, action: p.action, label: p.label });
    }

    const roles = ALL_ROLES.map((role) => {
      const assigned = new Set(
        rolePerms
          .filter((rp) => rp.role === role)
          .map((rp) => rp.permission.code)
      );
      return {
        role,
        userCount: userCountMap.get(role) || 0,
        permissions: allPerms.map((p) => ({ code: p.code, resource: p.resource, action: p.action, label: p.label, granted: assigned.has(p.code) })),
      };
    });

    const resources = Object.keys(grouped).sort();

    return NextResponse.json({ roles, resources, allPermissions: allPerms });
  });
}

export async function PUT(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.USER.UPDATE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { role, permissions } = body as { role: string; permissions: string[] };

    if (!role || !ALL_ROLES.includes(role as typeof ALL_ROLES[number])) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }
    if (role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya Super Admin yang dapat mengedit role SUPER_ADMIN' }, { status: 403 });
    }
    if (role === session?.role) {
      return NextResponse.json({ error: 'Tidak dapat mengedit role sendiri' }, { status: 403 });
    }

    let tenantId: string | null;
    if (session?.role === 'SUPER_ADMIN') {
      if (!body.tenantId) {
        return NextResponse.json({ error: 'tenantId wajib untuk Super Admin' }, { status: 400 });
      }
      tenantId = body.tenantId;
    } else {
      tenantId = session?.tenantId;
    }

    const allPermCodes = await prisma.permission.findMany({ select: { code: true } });
    const validCodes = new Set(allPermCodes.map((p) => p.code));
    const filteredPerms = (permissions || []).filter((c: string) => validCodes.has(c));

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role: role as never, tenantId } });

      if (filteredPerms.length > 0) {
        const permRows = await tx.permission.findMany({ where: { code: { in: filteredPerms } } });
        await tx.rolePermission.createMany({
          data: permRows.map((p) => ({ permissionId: p.id, role: role as never, tenantId })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  });
}
