import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSession, verifyTwoFactorToken } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { verifyTotp, verifyBackupCode, removeBackupCode } from '@/lib/totp';
import { getClientIp, recordLoginAttempt, isLoginBlocked, getRemainingAttempts, getLockoutDuration } from '@/lib/security';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { token, code } = body || {};
    if (!token || !code) {
      return NextResponse.json({ error: 'Token dan kode 2FA wajib diisi' }, { status: 400 });
    }

    const userId = await verifyTwoFactorToken(String(token));
    if (!userId) {
      return NextResponse.json({ error: 'Sesi 2FA kedaluwarsa. Silakan login ulang.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Akun tidak ditemukan atau tidak aktif' }, { status: 403 });
    }
    if (!user.totpEnabled) {
      return NextResponse.json({ error: '2FA tidak aktif untuk akun ini' }, { status: 400 });
    }

    if (await isLoginBlocked(user.username, ip)) {
      const retryAfter = await getLockoutDuration(user.username, ip);
      return NextResponse.json(
        { error: `Terlalu banyak percobaan kode 2FA. Silakan coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`, retryAfter },
        { status: 429 }
      );
    }

    const inputCode = String(code).trim();
    const totpOk = user.totpSecret ? verifyTotp(user.totpSecret, inputCode) : false;
    const backupOk = verifyBackupCode(user.backupCodes, inputCode);

    if (!totpOk && !backupOk) {
      await recordLoginAttempt(user.username, ip, false);
      await logAudit(null, 'TWO_FACTOR_LOGIN_FAILED', 'AUTH', { newData: { username: user.username } }, req);
      const remainingAttempts = await getRemainingAttempts(user.username, ip);
      return NextResponse.json({ error: 'Kode 2FA salah', remainingAttempts }, { status: 401 });
    }

    if (backupOk) {
      const remaining = removeBackupCode(user.backupCodes, inputCode);
      await prisma.user.update({ where: { id: user.id }, data: { backupCodes: remaining } });
    }

    await recordLoginAttempt(user.username, ip, true);
    await setSession({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId, branchId: user.branchId, pwdVersion: user.pwdVersion });
    await logAudit(null, 'TWO_FACTOR_LOGIN_SUCCESS', 'AUTH', { newData: { username: user.username } }, req);

    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (e) {
    logger.error('Two-factor auth error', { context: 'two_factor', error: String(e) });
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
