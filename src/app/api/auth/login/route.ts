import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSession, signTwoFactorToken } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { getClientIp, isLoginBlocked, recordLoginAttempt, cleanupLoginAttempts } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    await cleanupLoginAttempts();
    const body = await req.json();
    const { username, password } = body || {};
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const key = String(username).trim().toLowerCase();
    if (await isLoginBlocked(key, ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.' },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username: key } });
    if (!user) {
      await recordLoginAttempt(key, ip, false);
      await prisma.auditLog.create({
        data: { action: 'LOGIN_FAILED', module: 'AUTH', newData: `username=${key}, ip=${ip}` },
      });
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }
    if (user.status !== 'ACTIVE') {
      await recordLoginAttempt(key, ip, false);
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await recordLoginAttempt(key, ip, false);
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'LOGIN_FAILED', module: 'AUTH', newData: `ip=${ip}` },
      });
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    await recordLoginAttempt(key, ip, true);

    if (user.totpEnabled) {
      const twoFactorToken = await signTwoFactorToken(user.id);
      return NextResponse.json({
        twoFactorRequired: true,
        twoFactorToken,
      });
    }

    await setSession({ id: user.id, name: user.name, username: user.username, role: user.role, pwdVersion: user.pwdVersion });
    await logAudit(null, 'LOGIN_SUCCESS', 'AUTH', { newData: { username: user.username } }, req);
    return NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (e) {
    console.error('login error', e);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}