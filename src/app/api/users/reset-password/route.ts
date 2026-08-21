import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { generateRandomPassword, BCRYPT_COST } from '@/lib/security';
import { sendTextMessage, toE164, isWhatsAppEnabled } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.USER.UPDATE);
  if (error) return error;

  const isSuperAdmin = session.role === 'SUPER_ADMIN';

  const body = await req.json();
  const userId = body.userId?.toString();
  if (!userId) {
    return NextResponse.json({ error: 'userId wajib diisi' }, { status: 400 });
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });

    if (!isSuperAdmin && user.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Tidak memiliki akses ke user ini' }, { status: 403 });
    }

    const newPassword = generateRandomPassword(12);
    const hash = bcrypt.hashSync(newPassword, BCRYPT_COST);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hash,
        pwdVersion: { increment: 1 },
        mustChangePassword: true,
        lastPasswordChange: new Date(),
      },
      select: {
        id: true, name: true, username: true, role: true, status: true,
        phone: true, mustChangePassword: true, lastPasswordChange: true, createdAt: true,
        driver: { select: { id: true, employeeId: true, name: true } },
      },
    });

    await logAudit(
      session,
      'RESET_PASSWORD',
      'USER',
      { newData: { targetUsername: user.username, targetName: user.name, mustChangePassword: true, sentVia: 'ADMIN' } },
      req
    );

    let waSent = false;
    let waError = '';
    if (isWhatsAppEnabled() && user.phone) {
      try {
        const msg = [
          `Halo ${user.name},`,
          ``,
          `Akun Anda di DTMS telah direset oleh administrator.`,
          ``,
          `Username: *${user.username}*`,
          `Password baru: *${newPassword}*`,
          ``,
          `Silakan login dan segera ganti password Anda.`,
          `Anda akan diminta mengganti password saat login pertama kali.`,
        ].join('\n');
        const result = await sendTextMessage(toE164(user.phone), msg);
        waSent = result.success;
        if (!result.success) waError = result.error || 'Gagal mengirim';
      } catch (e) {
        waError = String(e);
      }
    }

    return NextResponse.json({
      user: updated,
      waSent,
      waError: waSent ? undefined : waError,
      message: waSent
        ? `Password direset. WhatsApp terkirim ke ${user.phone}.`
        : user.phone
          ? `Password direset. Gagal kirim WhatsApp: ${waError}`
          : `Password direset. User tidak memiliki nomor WhatsApp.`,
    });
  });
}
