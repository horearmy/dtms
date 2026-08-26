import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET);

/**
 * Konfigurasi Relying Party (Blueprint §8).
 * rpID harus berupa domain tanpa skema/port; origin harus cocok persis
 * dengan origin browser saat seremoni WebAuthn.
 */
export function getRp(): { rpID: string; rpName: string; origins: string[] } {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL(appUrl);
  const rpID = url.hostname;
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const origin = port === '80' || port === '443' ? `${url.protocol}//${rpID}` : `${url.protocol}//${rpID}:${port}`;
  return { rpID, rpName: 'DTMS Admin', origins: [origin] };
}

/**
 * Challenge disimpan stateless sebagai JWT pendek yang diikat ke
 * userId + jenis operasi — tanpa tabel sementara (Blueprint §37).
 */
export async function signWebauthnChallenge(uid: string, kind: 'register' | 'login'): Promise<string> {
  return new SignJWT({ purpose: `wa_${kind}`, uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(SECRET);
}

export async function verifyWebauthnChallenge(
  token: string,
  kind: 'register' | 'login'
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== `wa_${kind}` || typeof payload.uid !== 'string') return null;
    return payload.uid;
  } catch {
    return null;
  }
}
