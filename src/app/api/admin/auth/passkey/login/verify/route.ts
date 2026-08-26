import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  buildFingerprint, getClientIpSa, isIpWhitelisted, isSaRateLimited, recordSaAttempt,
  issueSuperadminSession, resetSaAttempts, resetSaAccountFailures,
} from '@/lib/superadmin-auth';
import { getRp, verifyWebauthnChallenge } from '@/lib/webauthn';
import { assessRisk } from '@/lib/admin-risk';

/**
 * POST /api/admin/auth/passkey/login/verify — Blueprint §7/§8
 * Passkey = faktor primer; berhasil -> sesi privileged langsung diterbitkan.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIpSa(req);
    if (!isIpWhitelisted(ip)) {
      return NextResponse.json({ error: 'Akses ditolak dari IP ini' }, { status: 403 });
    }
    const rl = isSaRateLimited(ip);
    if (rl.blocked) {
      return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(rl.retryAfter! / 60)} menit.`, retryAfter: rl.retryAfter }, { status: 429 });
    }

    const body = await req.json();
    const uidFromChallenge = await verifyWebauthnChallenge(String(body.challenge || ''), 'login');
    if (!uidFromChallenge) {
      return NextResponse.json({ error: 'Challenge kedaluwarsa. Mulai dari awal.' }, { status: 401 });
    }

    const credId = body.response?.id;
    if (!credId) return NextResponse.json({ error: 'Respons passkey tidak lengkap' }, { status: 400 });

    const cred = await prisma.passkeyCredential.findUnique({
      where: { credentialId: String(credId) },
      include: { user: true },
    });
    if (!cred || cred.revokedAt || cred.userId !== uidFromChallenge) {
      recordSaAttempt(ip);
      return NextResponse.json({ error: 'Passkey tidak dikenali' }, { status: 401 });
    }
    const user = cred.user;
    if (user.status !== 'ACTIVE' || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akun tidak valid' }, { status: 403 });
    }

    const { rpID, origins } = getRp();
    let verified = false;
    try {
      const verification = await verifyAuthenticationResponse({
        response: body.response as AuthenticationResponseJSON,
        expectedChallenge: String(body.challenge),
        expectedOrigin: origins[0],
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: cred.credentialId,
          publicKey: Buffer.from(cred.publicKey, 'base64url'),
          counter: cred.counter,
          transports: (cred.transports as never) || undefined,
        },
      });
      verified = verification.verified;

      // Clone detection (Blueprint §35 counter)
      if (verified && verification.authenticationInfo.newCounter <= cred.counter && verification.authenticationInfo.newCounter !== 0) {
        logger.error('Passkey clone suspected', { context: 'passkey', credentialId: cred.credentialId.slice(-8) });
        await prisma.passkeyCredential.update({ where: { id: cred.id }, data: { revokedAt: new Date() } }).catch(() => {});
        verified = false;
      } else if (verified) {
        await prisma.passkeyCredential.update({
          where: { id: cred.id },
          data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
        }).catch(() => {});
      }
    } catch (e) {
      logger.error('Passkey assertion error', { context: 'passkey', error: String(e) });
    }

    if (!verified) {
      recordSaAttempt(ip);
      await prisma.auditLog.create({ data: {
        userId: user.id, action: 'SUPERADMIN_MFA_FAILED', module: 'AUTH',
        newData: JSON.stringify({ method: 'passkey', ip }), ip,
        userAgent: (req.headers.get('user-agent') || '').slice(0, 250),
      }}).catch(() => {});
      return NextResponse.json({ error: 'Verifikasi passkey gagal' }, { status: 401 });
    }

    resetSaAttempts(ip);
    resetSaAccountFailures(user.username);

    const fingerprint = buildFingerprint(req);
    const risk = await assessRisk({ userId: user.id, ip, userAgent: req.headers.get('user-agent') });
    await issueSuperadminSession(req, user, fingerprint, ip, 'passkey', risk);

    return NextResponse.json({
      id: user.id, name: user.name, role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (e) {
    logger.error('Passkey login verify error', { context: 'passkey', error: String(e) });
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
