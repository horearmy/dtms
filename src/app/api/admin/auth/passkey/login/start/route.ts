import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { verifySuperAdminStep1Token } from '@/lib/superadmin-auth';
import { getRp, signWebauthnChallenge } from '@/lib/webauthn';

/**
 * POST /api/admin/auth/passkey/login/start — Blueprint §36
 * Setelah step-1 (secret key) valid. Minta username untuk memfilter kredensial;
 * respons generik agar tidak membocorkan keberadaan akun (Blueprint §26).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken, username } = body || {};
    if (!sessionToken || !username) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }
    if (!(await verifySuperAdminStep1Token(String(sessionToken)))) {
      return NextResponse.json({ error: 'Sesi expired. Mulai dari awal.' }, { status: 401 });
    }

    const key = String(username).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { username: key, tenantId: null, role: 'SUPER_ADMIN', status: 'ACTIVE' },
      include: { passkeys: { where: { revokedAt: null }, select: { credentialId: true, transports: true } } },
    });

    // Respons generik untuk user tanpa passkey (anti-enumeration)
    if (!user || user.passkeys.length === 0) {
      return NextResponse.json({ error: 'Passkey tidak tersedia untuk akun ini' }, { status: 404 });
    }

    const { rpID } = getRp();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: user.passkeys.map((p) => ({
        id: p.credentialId,
        transports: (p.transports as never) || undefined,
      })),
    });

    const challenge = await signWebauthnChallenge(user.id, 'login');
    return NextResponse.json({ options, challenge });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
