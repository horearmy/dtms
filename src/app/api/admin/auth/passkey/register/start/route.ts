import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { getRp, signWebauthnChallenge, verifyWebauthnChallenge } from '@/lib/webauthn';

/**
 * POST /api/admin/auth/passkey/register/start — Blueprint §8/§36
 * Dipanggil saat SA sudah login. Menghasilkan opsi pembuatan kredensial.
 */
export async function POST() {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  const { rpID, rpName } = getRp();
  const existing = await prisma.passkeyCredential.findMany({
    where: { userId: session!.id, revokedAt: null },
    select: { credentialId: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: session!.username,
    userDisplayName: session!.name,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: 'discouraged',
      userVerification: 'required',
    },
  });

  const challenge = await signWebauthnChallenge(session!.id, 'register');
  return NextResponse.json({ options, challenge });
}
