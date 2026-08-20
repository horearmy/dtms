import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';
import { logAudit, runWithTenant } from '@/lib/api-guard';
import { validatePassword } from '@/lib/security';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = body.token?.toString().trim();
  const newPassword = body.newPassword?.toString();

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token dan password baru wajib diisi' }, { status: 400 });
  }

  const { valid: pwValid, error: pwError } = validatePassword(newPassword);
  if (!pwValid) return NextResponse.json({ error: pwError }, { status: 400 });

  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { token: tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!resetToken) {
    return NextResponse.json({ error: 'Token tidak valid atau sudah kedaluwarsa' }, { status: 400 });
  }

  const user = resetToken.user;
  const hash = bcrypt.hashSync(newPassword, 10);

  return runWithTenant(user.tenantId, async () => {
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hash,
          pwdVersion: { increment: 1 },
          mustChangePassword: false,
          lastPasswordChange: new Date(),
        },
      }),
    ]);

    await logAudit(
      { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId, branchId: null },
      'RESET_PASSWORD_SELF',
      'AUTH',
      { newData: { method: 'TOKEN' } },
      req
    );

    return NextResponse.json({ ok: true, message: 'Password berhasil diubah. Silakan login.' });
  });
}
