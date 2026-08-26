import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { logger } from '@/lib/logger';
import { getRp, verifyWebauthnChallenge } from '@/lib/webauthn';

/**
 * POST /api/admin/auth/passkey/register/verify — Blueprint §8/§35 PasskeyCredential
 * Body: { challenge: string; response: RegistrationResponseJSON; deviceName?: string }
 */
export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  try {
    const body = await req.json();
    const uid = await verifyWebauthnChallenge(String(body.challenge || ''), 'register');
    if (!uid || uid !== session!.id) {
      return NextResponse.json({ error: 'Challenge tidak valid atau kedaluwarsa' }, { status: 401 });
    }

    const { rpID, origins } = getRp();
    const verification = await verifyRegistrationResponse({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: String(body.challenge),
      expectedOrigin: origins[0],
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verifikasi passkey gagal' }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    await prisma.passkeyCredential.create({
      data: {
        userId: session!.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        deviceName: String(body.deviceName || 'Passkey').slice(0, 60),
        transports: credential.transports || [],
      },
    });

    await logAudit(session, 'SUPERADMIN_PASSKEY_ADDED', 'AUTH', { newData: { credentialId: credential.id.slice(-8) } }, req);
    return NextResponse.json({ ok: true, verified: true });
  } catch (e) {
    logger.error('Passkey register verify error', { context: 'passkey', error: String(e) });
    return NextResponse.json({ error: 'Verifikasi passkey gagal' }, { status: 400 });
  }
}
