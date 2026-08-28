import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant, guardPlanLimit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { generateRandomPassword, BCRYPT_COST } from '@/lib/security';
import { sendTextMessage, toE164, isWhatsAppEnabled } from '@/lib/whatsapp';

const ASSIGNABLE_ROLES: string[] = [
  'SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE',
  'CUSTOMER_SERVICE', 'SUPERVISOR', 'MANAGEMENT',
];

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.USER.CREATE);
  if (error) return error;
  const limitError = await guardPlanLimit(session, 'users');
  if (limitError) return limitError;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  const body = await req.json();
  const name = body.name?.toString().trim();
  const username = body.username?.toString().trim().toLowerCase();
  const phone = body.phone?.toString().trim() || null;
  const role = body.role?.toString() || '';
  const email = body.email?.toString().trim() || null;
  const targetTenantId = isSuperAdmin ? (body.tenantId?.toString() || session?.tenantId || null) : session?.tenantId;

  if (!name || !username || !role) {
    return NextResponse.json({ error: 'Nama, username, dan role wajib diisi' }, { status: 400 });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
  }
  if (role === 'SUPER_ADMIN' && session?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Hanya Super Admin yang dapat membuat akun Super Admin' }, { status: 403 });
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const plainPassword = generateRandomPassword(12);
    const hash = await bcrypt.hash(plainPassword, BCRYPT_COST);

    try {
      const user = await prisma.user.create({
        data: {
          name,
          username,
          passwordHash: hash,
          email,
          phone,
          role: role as Role,
          status: 'ACTIVE',
          tenantId: targetTenantId,
          pwdVersion: 1,
          mustChangePassword: true,
        },
        select: {
          id: true, name: true, username: true, role: true, status: true,
          phone: true, mustChangePassword: true, lastPasswordChange: true, createdAt: true,
          driver: { select: { id: true, employeeId: true, name: true } },
        },
      });

      await logAudit(session, 'INVITE_USER', 'USER', {
        newData: { username: user.username, name: user.name, role: user.role, sentVia: phone ? 'WHATSAPP' : 'NONE' },
      }, req);

      let waSent = false;
      let waError = '';
      if (isWhatsAppEnabled() && phone) {
        try {
          const msg = [
            `Halo ${name},`,
            ``,
            `Akun Anda di DTMS telah dibuat.`,
            ``,
            `Username: *${username}*`,
            `Password: *${plainPassword}*`,
            ``,
            `Silakan login dan segera ganti password Anda.`,
            `Anda akan diminta mengganti password saat login pertama kali.`,
          ].join('\n');
          const result = await sendTextMessage(toE164(phone), msg);
          waSent = result.success;
          if (!result.success) waError = result.error || 'Gagal mengirim';
        } catch (e) {
          waError = String(e);
        }
      }

      return NextResponse.json({
        user,
        waSent,
        waError: waSent ? undefined : waError,
        message: waSent
          ? `Akun dibuat. WhatsApp terkirim ke ${phone}.`
          : phone
            ? `Akun dibuat. Gagal kirim WhatsApp: ${waError}`
            : `Akun dibuat. User tidak memiliki nomor WhatsApp.`,
      }, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 });
    }
  });
}
