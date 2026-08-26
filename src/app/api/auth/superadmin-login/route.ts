import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/api-guard';
import { logger } from '@/lib/logger';
import { verifyTotp, verifyBackupCode, removeBackupCode } from '@/lib/totp';
import { ADMIN_AUTH_POLICY } from '@/lib/admin-policy';
import {
  getClientIpSa, isIpWhitelisted, verifySecretKey, buildFingerprint,
  signSuperAdminStep1Token, verifySuperAdminStep1Token,
  signSuperAdminMfaToken, verifySuperAdminMfaToken,
  setSuperAdminSession, resetSaAttempts,
  isSaRateLimited, recordSaAttempt,
  isSaAccountBlocked, recordSaAccountFailure, resetSaAccountFailures,
} from '@/lib/superadmin-auth';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpSa(req);
    const body = await req.json();
    const { step, secretKey, sessionToken, mfaToken, username, password, code } = body || {};

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

      // Lockout per-akun — Blueprint §25 (IP-only dapat di-bypass rotasi IP)
      const acctLock = isSaAccountBlocked(username);
      if (acctLock.blocked) {
        await logAudit(null, 'SUPERADMIN_LOGIN_BLOCKED', 'AUTH', { newData: { reason: 'account_lockout', username, ip } }, req);
        return NextResponse.json(
          { error: `Akun terkunci sementara. Coba lagi dalam ${Math.ceil((acctLock.retryAfterSec || 0) / 60)} menit.`, retryAfter: acctLock.retryAfterSec },
          { status: 429 }
        );
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
        recordSaAccountFailure(key);
        await logAudit(user ? { id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null } : null, 'SUPERADMIN_LOGIN_FAILED', 'AUTH', { newData: { username: key, ip } }, req);
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        recordSaAttempt(ip);
        recordSaAccountFailure(key);
        await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_LOGIN_FAILED', 'AUTH', { newData: { ip } }, req);
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
      }

      resetSaAttempts(ip);
      resetSaAccountFailures(key);

      // ── MFA wajib bila TOTP terdaftar atau policy menuntut ──
      if (user.totpEnabled) {
        const mfaToken = await signSuperAdminMfaToken(user.id);
        return NextResponse.json({
          mfaRequired: true,
          mfaToken,
          backupAllowed: !!user.backupCodes,
        });
      }
      if (ADMIN_AUTH_POLICY.requireMFA) {
        await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_LOGIN_BLOCKED', 'AUTH', { newData: { reason: 'mfa_not_enrolled', ip } }, req);
        return NextResponse.json(
          { error: 'Kebijakan keamanan mewajibkan 2FA. Aktifkan TOTP terlebih dahulu.', mfaNotEnrolled: true },
          { status: 403 }
        );
      }

      await issueSuperadminSession(req, user, fingerprint, ip);
      return NextResponse.json({
        id: user.id,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });
    }

    if (step === 3) {
      if (!mfaToken || !code) {
        return NextResponse.json({ error: 'Kode verifikasi wajib diisi' }, { status: 400 });
      }

      const userId = await verifySuperAdminMfaToken(mfaToken);
      if (!userId) {
        return NextResponse.json({ error: 'Sesi MFA kedaluwarsa. Mulai dari awal.' }, { status: 401 });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'SUPER_ADMIN' || user.status !== 'ACTIVE' || !user.totpEnabled) {
        return NextResponse.json({ error: 'Sesi tidak valid. Mulai dari awal.' }, { status: 401 });
      }

      let usedBackupCode = false;
      let mfaOk = false;
      if (/^\d{6}$/.test(String(code).replace(/\s/g, ''))) {
        mfaOk = verifyTotp(user.totpSecret || '', String(code));
      }
      if (!mfaOk && user.backupCodes && verifyBackupCode(user.backupCodes, String(code))) {
        mfaOk = true;
        usedBackupCode = true;
      }

      if (!mfaOk) {
        recordSaAttempt(ip);
        recordSaAccountFailure(user.username);
        await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_MFA_FAILED', 'AUTH', { newData: { method: /^\d{6}$/.test(String(code).trim()) ? 'totp' : 'recovery_code', ip } }, req);
        return NextResponse.json({ error: 'Kode verifikasi salah' }, { status: 401 });
      }

      if (usedBackupCode && user.backupCodes) {
        const remaining = removeBackupCode(user.backupCodes, String(code));
        await prisma.user.update({ where: { id: user.id }, data: { backupCodes: remaining } }).catch(() => {});
      }

      const fingerprint = buildFingerprint(req);
      resetSaAttempts(ip);
      resetSaAccountFailures(user.username);

      await issueSuperadminSession(req, user, fingerprint, ip);
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

/** Terbitkan sesi privileged + audit lengkap (Blueprint §27) */
async function issueSuperadminSession(
  req: NextRequest,
  user: { id: string; name: string; username: string; role: string; tenantId: string | null; branchId: string | null; pwdVersion: number; mustChangePassword: boolean; lastLoginAt: Date | null; lastLoginIp: string | null; totpEnabled: boolean },
  fingerprint: string,
  ip: string
) {
  await setSuperAdminSession({
    id: user.id, name: user.name, username: user.username,
    role: user.role, tenantId: user.tenantId, branchId: user.branchId,
    pwdVersion: user.pwdVersion, mustChangePassword: user.mustChangePassword,
  }, fingerprint);

  await logAudit({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: null, branchId: null }, 'SUPERADMIN_SESSION_CREATED', 'AUTH', {
    newData: {
      username: user.username,
      fingerprint,
      authenticationMethod: 'password+totp',
      mfa: user.totpEnabled ? 'totp' : 'disabled',
      ua: req.headers.get('user-agent') || 'unknown',
      lastLoginAt: user.lastLoginAt?.toISOString(),
      lastLoginIp: user.lastLoginIp,
    },
  }, req);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  }).catch(() => {});
}
