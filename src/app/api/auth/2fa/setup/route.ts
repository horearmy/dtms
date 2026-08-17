import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import {
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
} from '@/lib/totp';
import { encryptSecret } from '@/lib/totp-encrypt';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
  if (user.totpEnabled) {
    return NextResponse.json({ enabled: true, error: '2FA sudah aktif' }, { status: 400 });
  }

  const secret = generateTotpSecret();
  const encryptedSecret = encryptSecret(secret);
  await prisma.user.update({
    where: { id: session.id },
    data: { totpSecret: encryptedSecret, totpEnabled: false },
  });

  return NextResponse.json({
    enabled: false,
    secret,
    otpauth: otpauthUrl(secret, session.username),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const body = await req.json();
  const code = String(body.code || '').trim();
  if (!code) {
    return NextResponse.json({ error: 'Kode verifikasi wajib diisi' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });
  if (user.totpEnabled) {
    return NextResponse.json({ error: '2FA sudah aktif' }, { status: 400 });
  }
  if (!user.totpSecret) {
    return NextResponse.json({ error: 'Mulai setup 2FA terlebih dahulu' }, { status: 400 });
  }

  if (!verifyTotp(user.totpSecret, code)) {
    await logAudit(session, 'TWO_FACTOR_SETUP_FAILED', 'AUTH', {}, req);
    return NextResponse.json({ error: 'Kode verifikasi salah' }, { status: 400 });
  }

  const backupCodes = generateBackupCodes();
  await prisma.user.update({
    where: { id: session.id },
    data: { totpEnabled: true, backupCodes: hashBackupCodes(backupCodes) },
  });

  await logAudit(session, 'TWO_FACTOR_ENABLED', 'AUTH', { newData: { enabled: true } }, req);
  return NextResponse.json({ ok: true, enabled: true, backupCodes });
}
