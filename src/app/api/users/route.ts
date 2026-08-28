import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant, guardPlanLimit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { validatePassword, BCRYPT_COST } from '@/lib/security';

const ASSIGNABLE_ROLES: string[] = [
  'SUPER_ADMIN',
  'ADMIN_OPERASIONAL',
  'DISPATCHER',
  'WAREHOUSE',
  'CUSTOMER_SERVICE',
  'SUPERVISOR',
  'MANAGEMENT',
];

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.USER.READ);
  if (error) return error;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const tenantFilter = isSuperAdmin ? {} : { tenantId: session.tenantId };

  return runWithTenant(session.tenantId ?? null, async () => {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
    const select = {
      id: true, name: true, username: true, role: true, status: true, phone: true,
      mustChangePassword: true, lastPasswordChange: true, createdAt: true, tenantId: true,
      driver: { select: { id: true, employeeId: true, name: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    };
    const where = { ...tenantFilter };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize, select }),
    ]);
    return NextResponse.json({ items: users, total, page, pageSize, isSuperAdmin });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.USER.CREATE);
  if (error) return error;
  const limitError = await guardPlanLimit(session, 'users');
  if (limitError) return limitError;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();

    const name = body.name?.toString().trim();
    const username = body.username?.toString().trim().toLowerCase();
    const password = body.password?.toString() || '';
    const role = body.role?.toString() || '';
    const phone = body.phone?.toString().trim() || null;
    const status = body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const targetTenantId = isSuperAdmin ? (body.tenantId?.toString() || session?.tenantId || null) : session?.tenantId;

    if (!name || !username || !role) {
      return NextResponse.json({ error: 'Nama, username, dan role wajib diisi' }, { status: 400 });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }
    const { valid: pwValid, error: pwError } = validatePassword(password);
    if (!pwValid) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }
    if (role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya Super Admin yang dapat membuat akun Super Admin' }, { status: 403 });
    }

    try {
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const user = await prisma.user.create({
        data: {
          name,
          username,
          passwordHash,
          role: role as Role,
          status,
          phone,
          tenantId: targetTenantId,
          pwdVersion: 1,
          mustChangePassword: false,
        },
        select: {
          id: true, name: true, username: true, role: true, status: true, phone: true,
          mustChangePassword: true, lastPasswordChange: true, createdAt: true, tenantId: true,
          driver: { select: { id: true, employeeId: true, name: true } },
        },
      });
      await logAudit(session, 'CREATE_USER', 'USER', { newData: { username: user.username, name: user.name, role: user.role, tenantId: targetTenantId } }, req);
      return NextResponse.json(user, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Username sudah terdaftar. Pilih username lain.' }, { status: 400 });
    }
  });
}
