import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession, setSession } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { validatePassword } from '@/lib/security';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body || {};
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Password lama dan baru wajib diisi' }, { status: 400 });
  }

  const pwError = validatePassword(newPassword);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Password lama salah' }, { status: 401 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Password baru harus berbeda dari password lama' }, { status: 400 });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      pwdVersion: { increment: 1 },
      mustChangePassword: false,
      lastPasswordChange: new Date(),
    },
  });

  await setSession({ id: updated.id, name: updated.name, username: updated.username, role: updated.role, tenantId: updated.tenantId, pwdVersion: updated.pwdVersion });
  await logAudit(session, 'CHANGE_PASSWORD', 'AUTH', { newData: { pwdVersion: updated.pwdVersion, changedAt: new Date().toISOString() } }, req);
  return NextResponse.json({ ok: true, message: 'Password berhasil diubah' });
}