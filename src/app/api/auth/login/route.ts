import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSession, signTwoFactorToken } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { getClientIp, isLoginBlocked, recordLoginAttempt, cleanupLoginAttempts, getRemainingAttempts, getLockoutDuration } from '@/lib/security';
import { setTenantCookie } from '@/lib/tenant';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const secureCookies = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
    const ip = getClientIp(req);
    await cleanupLoginAttempts();
    const body = await req.json();
    const { username, password, tenantId } = body || {};
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const key = String(username).trim().toLowerCase();
    if (await isLoginBlocked(key, ip)) {
      const retryAfter = await getLockoutDuration(key, ip);
      return NextResponse.json(
        { error: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`, retryAfter },
        { status: 429 }
      );
    }

    let user;
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: String(tenantId) } });
      if (!tenant || !tenant.active) {
        return NextResponse.json({ error: 'Perusahaan tidak valid atau tidak aktif' }, { status: 400 });
      }
      user = await prisma.user.findFirst({ where: { username: key, tenantId: String(tenantId) } });
    } else {
      user = await prisma.user.findFirst({ where: { username: key, tenantId: null } });
      // Blueprint §38: superadmin TIDAK login lewat pintu tenant biasa.
      // Satu-satunya jalur: /admin/secure-login (secret key + MFA/passkey).
      if (user) user = null;
    }
    // Hash dummy untuk menyamakan waktu respons antara user tak dikenal dan password salah
    const DUMMY_HASH = '$2a$12$N6EIOlmbK6eF0YXpMxJ9xOKbXzvPgD3s9rxQut.vH0B0muqr3zloG';
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
      await recordLoginAttempt(key, ip, false);
      await prisma.auditLog.create({
        data: { action: 'LOGIN_FAILED', module: 'AUTH', newData: `username=${key}, ip=${ip}, tenantId=${tenantId || 'none'}` },
      });
      const remainingAttempts = await getRemainingAttempts(key, ip);
      return NextResponse.json({ error: 'Username atau password salah', remainingAttempts }, { status: 401 });
    }
    if (user.status !== 'ACTIVE') {
      await recordLoginAttempt(key, ip, false);
      const remainingAttempts = await getRemainingAttempts(key, ip);
      return NextResponse.json({ error: 'Akun tidak aktif', remainingAttempts }, { status: 403 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await recordLoginAttempt(key, ip, false);
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'LOGIN_FAILED', module: 'AUTH', newData: `ip=${ip}` },
      });
      const remainingAttempts = await getRemainingAttempts(key, ip);
      return NextResponse.json({ error: 'Username atau password salah', remainingAttempts }, { status: 401 });
    }

    await recordLoginAttempt(key, ip, true);

    if (user.totpEnabled) {
      const twoFactorToken = await signTwoFactorToken(user.id);
      return NextResponse.json({
        twoFactorRequired: true,
        twoFactorToken,
      });
    }

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });

    await setSession({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId, branchId: user.branchId, pwdVersion: user.pwdVersion, mustChangePassword: user.mustChangePassword }, { secure: secureCookies });

    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true } });
      if (tenant) {
        const cookie = setTenantCookie(tenant.slug);
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.httpOnly,
          secure: secureCookies,
          sameSite: cookie.sameSite,
          path: cookie.path,
          maxAge: cookie.maxAge,
        });
      }
    }

    await logAudit(null, 'LOGIN_SUCCESS', 'AUTH', { newData: { username: user.username, tenantId: user.tenantId } }, req);
    return response;
  } catch (e) {
    logger.error('Login error', { context: 'login', error: String(e) });
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
