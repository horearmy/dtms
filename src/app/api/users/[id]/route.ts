import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { validatePassword } from '@/lib/security';

const ASSIGNABLE_ROLES: string[] = [
  'SUPER_ADMIN',
  'ADMIN_OPERASIONAL',
  'DISPATCHER',
  'WAREHOUSE',
  'CUSTOMER_SERVICE',
  'SUPERVISOR',
  'MANAGEMENT',
];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, scope, error } = await guardPermission(PERMISSIONS.USER.UPDATE);
  if (error) return error;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    if (!isSuperAdmin && target.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Tidak memiliki akses ke user ini' }, { status: 403 });
    }

    const name = body.name?.toString().trim() || target.name;
    const phone = body.phone === undefined ? target.phone : body.phone?.toString().trim() || null;
    const role = body.role?.toString() || target.role;
    const status = body.status === 'ACTIVE' || body.status === 'INACTIVE' ? body.status : target.status;
    const password = body.password?.toString() || '';

    if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
    }
    if (role === 'SUPER_ADMIN' && target.role !== 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya Super Admin yang dapat menetapkan role Super Admin' }, { status: 403 });
    }
    if (id === session?.id && status === 'INACTIVE') {
      return NextResponse.json({ error: 'Tidak dapat menonaktifkan akun sendiri' }, { status: 400 });
    }
    if (password) {
      const { valid: pwValid, error: pwError } = validatePassword(password);
      if (!pwValid) return NextResponse.json({ error: pwError }, { status: 400 });
    }

    try {
      const data: Record<string, unknown> = {
        name,
        phone,
        role: role as Role,
        status,
      };
      if (password) {
        data.passwordHash = bcrypt.hashSync(password, 10);
        data.pwdVersion = { increment: 1 };
        data.mustChangePassword = false;
        data.lastPasswordChange = new Date();
      }
      const updated = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true, name: true, username: true, role: true, status: true, phone: true,
          mustChangePassword: true, lastPasswordChange: true, createdAt: true, tenantId: true,
          driver: { select: { id: true, employeeId: true, name: true } },
        },
      });
      await logAudit(
        session,
        'UPDATE_USER',
        'USER',
        {
          oldData: { username: target.username, name: target.name, role: target.role, status: target.status },
          newData: { username: updated.username, name: updated.name, role: updated.role, status: updated.status, resetPassword: !!password },
        },
        req
      );
      return NextResponse.json(updated);
    } catch {
      return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 400 });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, scope, error } = await guardPermission(PERMISSIONS.USER.DELETE);
  if (error) return error;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  return runWithTenant(session?.tenantId ?? null, async () => {
    if (id === session?.id) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });
    }
    const target = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { notifications: true } } },
    });
    if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    if (!isSuperAdmin && target.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Tidak memiliki akses ke user ini' }, { status: 403 });
    }
    if (target.role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya Super Admin yang dapat menghapus akun Super Admin' }, { status: 403 });
    }
    try {
      await prisma.user.delete({ where: { id } });
    } catch {
      return NextResponse.json({ error: 'Tidak dapat menghapus user' }, { status: 400 });
    }
    await logAudit(session, 'DELETE_USER', 'USER', { oldData: { username: target.username, name: target.name, tenantId: target.tenantId } }, req);
    return NextResponse.json({ ok: true });
  });
}
