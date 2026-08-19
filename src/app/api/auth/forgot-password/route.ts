import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTextMessage, toE164, isWhatsAppEnabled } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';

const TOKEN_TTL_MINUTES = 15;

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  for (let i = 0; i < 32; i++) token += chars[bytes[i] % chars.length];
  return token;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }
  const identifier = body.identifier?.toString().trim().toLowerCase();

  if (!identifier) {
    return NextResponse.json({ error: 'Masukkan username atau nomor telepon' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { phone: { contains: identifier } },
      ],
      status: 'ACTIVE',
    },
  });

  if (!user) {
    return NextResponse.json({
      ok: true,
      message: 'Jika akun ditemukan, instruksi reset sudah dikirim.',
    });
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  let sent = false;
  let waError = '';
  if (isWhatsAppEnabled() && user.phone) {
    try {
      const resetUrl = `${process.env.APP_URL || ''}/reset-password?token=${token}`;
      const msg = [
        `Halo ${user.name},`,
        ``,
        `Anda meminta reset password di DTMS.`,
        ``,
        `Kode reset: *${token.slice(0, 8)}*`,
        ``,
        `Atau buka link ini:`,
        resetUrl,
        ``,
        `Link ini berlaku selama ${TOKEN_TTL_MINUTES} menit.`,
        `Jika Anda tidak meminta ini, abaikan pesan ini.`,
      ].join('\n');
      const result = await sendTextMessage(toE164(user.phone), msg);
      sent = result.success;
      if (!result.success) waError = result.error || '';
    } catch (e) {
      waError = String(e);
    }
  }

  logger.info('Password reset requested', { context: 'auth', data: { userId: user.id, username: user.username, sent, waError } });

  return NextResponse.json({
    ok: true,
    message: sent
      ? 'Instruksi reset sudah dikirim via WhatsApp.'
      : user.phone
        ? `Gagal kirim WhatsApp${waError ? ': ' + waError : ''}. Coba lagi nanti.`
        : 'Akun tidak memiliki nomor WhatsApp. Hubungi admin.',
    sent,
  });
}
