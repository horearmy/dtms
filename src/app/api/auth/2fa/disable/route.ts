import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit, runWithTenant } from '@/lib/api-guard';
import { verifyTotp, verifyBackupCode } from '@/lib/totp';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  return runWithTenant(session.tenantId, async () => {
    const body = await req.json();
    const { code, password } = body || {};
    if (!code || !password) {
      return NextResponse.json({ error: 'Password dan kode 2FA/backup code wajib diisi' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
    if (!user.totpEnabled) {
      return NextResponse.json({ error: '2FA tidak aktif' }, { status: 400 });
    }

    const codeOk = user.totpSecret
      ? verifyTotp(user.totpSecret, String(code || '')) ||
        verifyBackupCode(user.backupCodes, String(code || ''))
      : false;
    const pwOk = password ? await bcrypt.compare(String(password), user.passwordHash) : false;

    if (!codeOk || !pwOk) {
      await logAudit(session, 'TWO_FACTOR_DISABLE_FAILED', 'AUTH', {}, req);
      return NextResponse.json({ error: 'Password dan kode 2FA/backup code wajib diisi dengan benar' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { totpEnabled: false, totpSecret: null, backupCodes: null },
    });

    await logAudit(session, 'TWO_FACTOR_DISABLED', 'AUTH', { newData: { enabled: false } }, req);
    return NextResponse.json({ ok: true, enabled: false });
  });
}
