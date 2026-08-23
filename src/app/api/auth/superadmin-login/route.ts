import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/api-guard';
import { logger } from '@/lib/logger';
import {
  getClientIpSa, isIpWhitelisted, verifySecretKey, buildFingerprint,
  signSuperAdminStep1Token, verifySuperAdminStep1Token,
  setSuperAdminSession, resetSaAttempts,
  isSaRateLimited, recordSaAttempt,
} from '@/lib/superadmin-auth';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpSa(req);
    const body = await req.json();
    const { step, secretKey, sessionToken, username, password } = body || {};

    if (!isIpWhitelisted(ip)) {
      await logAudit(null, 'SUPERADMIN_LOGIN_BLOCKED', 'AUTH', { newData: { reason: 'ip_not_whitelisted', ip } }, req);
      return NextResponse.json({ error: 'Akses ditolak dari IP ini' }, { status: 403 });
    }

    const rl = isSaRateLimited(ip);
    if (rl.blocked) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rl.retryAfter! / 60)} menit.`, retryAfter: rl.retryAfter },
        { status: 429 }
      );
    }

    if (step === 1) {
      if (!secretKey) return NextResponse.json({ error: 'Secret key wajib diisi' }, { status: 400 });
      if (!verifySecretKey(secretKey)) {
        recordSaAttempt(ip);
        await logAudit(null, 'SUPERADMIN_SECRET_FAILED', 'AUTH', { newData: { ip, ua: req.headers.get('user-agent') || 'unknown' } }, req);
        return NextResponse.json({ error: 'Secret key salah' }, { status: 401 });
      }
      const token = await signSuperAdminStep1Token();
      await logAudit(null, 'SUPERADMIN_SECRET_OK', 'AUTH', { newData: { ip } }, req);
      return NextResponse.json({ sessionToken: token });
    }

    if (step === 2) {
      if (!sessionToken || !username || !password) {
        return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
      }

      const step1Valid = await verifySuperAdminStep1Token(sessionToken);
      if (!step1Valid) {
        return NextResponse.json({ error: 'Sesi expired. Mulai dari awal.' }, { status: 401 });
      }

      const fingerprint = buildFingerprint(req);
      const key = String(username).trim().toLowerCase();

      const user = await prisma.user.findFirst({
        where: { username: key, tenantId: null },
      });

      if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE') {
        recordSaAttempt(ip);
        await logAudit(user ? { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null } : null, 'SUPERADMIN_LOGIN_FAILED', 'AUTH', { newData: { username: key, ip } }, req);
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        recordSaAttempt(ip);
        await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_LOGIN_FAILED', 'AUTH', { newData: { ip } }, req);
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
      }

      resetSaAttempts(ip);

      await setSuperAdminSession({
        id: user.id, name: user.name, username: user.username,
        role: user.role, tenantId: user.tenantId, branchId: user.branchId,
        pwdVersion: user.pwdVersion,
      }, fingerprint);

      await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_LOGIN_SUCCESS', 'AUTH', {
        newData: {
          username: user.username,
          fingerprint,
          ua: req.headers.get('user-agent') || 'unknown',
          lastLoginAt: user.lastLoginAt?.toISOString(),
          lastLoginIp: user.lastLoginIp,
        },
      }, req);

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: ip },
      }).catch(() => {});

      return NextResponse.json({
        id: user.id,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });
    }

    return NextResponse.json({ error: 'Step tidak valid' }, { status: 400 });
  } catch (e) {
    logger.error('Superadmin login error', { context: 'superadmin-login', error: String(e) });
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
