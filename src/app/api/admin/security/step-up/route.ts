import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { verifyTotp, verifyBackupCode, removeBackupCode } from '@/lib/totp';
import { signStepUpToken } from '@/lib/superadmin-auth';

/**
 * POST /api/admin/security/step-up — Blueprint §20/§36
 * Verifikasi ulang identitas (password ATAU kode TOTP/recovery).
 * Sukses -> stepUpToken (5 menit) untuk dipakai endpoint kritis
 * via header 'x-step-up-token'.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  try {
    const body = await req.json();
    const user = await prisma.user.findUnique({ where: { id: session!.id } });
    if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Akun tidak valid' }, { status: 403 });
    }

    let ok = false;
    let method = '';
    const { password, code } = body || {};

    if (typeof password === 'string' && password) {
      ok = await bcrypt.compare(String(password), user.passwordHash);
      method = 'password';
    } else if (typeof code === 'string' && code && user.totpEnabled) {
      if (/^\d{6}$/.test(code.replace(/\s/g, ''))) {
        ok = verifyTotp(user.totpSecret || '', String(code));
      }
      if (!ok && user.backupCodes && verifyBackupCode(user.backupCodes, code)) {
        ok = true;
        const remaining = removeBackupCode(user.backupCodes, code);
        await prisma.user.update({ where: { id: user.id }, data: { backupCodes: remaining } }).catch(() => {});
      }
      method = 'totp';
    }

    if (!ok) {
      await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_STEP_UP_FAILED', 'AUTH', { newData: { method: method || 'none' } }, req);
      return NextResponse.json(
        { error: 'Verifikasi ulang gagal', stepUpRequired: true },
        { status: 401 }
      );
    }

    const stepUpToken = await signStepUpToken(user.id);
    await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_STEP_UP_SUCCESS', 'AUTH', { newData: { method } }, req);
    return NextResponse.json({ ok: true, stepUpToken });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
