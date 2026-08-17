import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guard, logAudit, runWithTenant } from '@/lib/api-guard';
import { validatePassword } from '@/lib/security';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL'];

const ASSIGNABLE_ROLES: string[] = [
  'SUPER_ADMIN',
  'ADMIN_OPERASIONAL',
  'DISPATCHER',
  'WAREHOUSE',
  'CUSTOMER_SERVICE',
  'SUPERVISOR',
  'MANAGEMENT',
];

const safeUser = <T extends { passwordHash?: string }>(u: T) => {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return rest;
};

export async function GET(req: NextRequest) {
  const { error } = await guard(...MANAGE);
  if (error) return error;
  return runWithTenant(null, async () => {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
    const select = {
      id: true, name: true, username: true, role: true, status: true, phone: true,
      mustChangePassword: true, lastPasswordChange: true, createdAt: true,
      driver: { select: { id: true, employeeId: true, name: true } },
    };
    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({ orderBy: { createdAt: 'asc' }, skip: (page - 1) * pageSize, take: pageSize, select }),
    ]);
    return NextResponse.json({ items: users, total, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard(...MANAGE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();

    const name = body.name?.toString().trim();
    const username = body.username?.toString().trim().toLowerCase();
    const password = body.password?.toString() || '';
    const role = body.role?.toString() || '';
    const phone = body.phone?.toString().trim() || null;
    const status = body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

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
      const user = await prisma.user.create({
        data: {
          name,
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          role: role as Role,
          status,
          phone,
          pwdVersion: 1,
          mustChangePassword: false,
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
          phone: true,
          mustChangePassword: true,
          lastPasswordChange: true,
          createdAt: true,
          driver: { select: { id: true, employeeId: true, name: true } },
        },
      });
      await logAudit(session, 'CREATE_USER', 'USER', { newData: { username: user.username, name: user.name, role: user.role } }, req);
      return NextResponse.json(user, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'Username sudah terdaftar. Pilih username lain.' }, { status: 400 });
    }
  });
}