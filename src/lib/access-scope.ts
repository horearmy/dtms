import { prisma } from './prisma';
import type { SessionUser } from './auth';

export type AccessScope = {
  tenantId: string | null;
  branchId: string | null;
  branchIds: string[];
  permissions: string[];
};

export async function resolveAccessScope(user: SessionUser): Promise<AccessScope> {
  if (user.role === 'SUPER_ADMIN') {
    return { tenantId: null, branchId: null, branchIds: [], permissions: ['*'] };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { tenantId: true, branchId: true, role: true },
  });

  if (!dbUser?.tenantId) {
    return { tenantId: null, branchId: null, branchIds: [], permissions: [] };
  }

  const rolePerms = await prisma.rolePermission.findMany({
    where: { role: dbUser.role, tenantId: dbUser.tenantId },
    include: { permission: { select: { code: true } } },
  });

  const permissions = rolePerms.map((rp) => rp.permission.code);

  return {
    tenantId: dbUser.tenantId,
    branchId: dbUser.branchId,
    branchIds: dbUser.branchId ? [dbUser.branchId] : [],
    permissions,
  };
}

export function hasPermission(scope: AccessScope, permission: string): boolean {
  if (scope.permissions.includes('*')) return true;
  return scope.permissions.includes(permission);
}
