import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { setSession, signTwoFactorToken } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { getClientIp, recordLoginAttempt } from '@/lib/security';
import { setTenantCookie } from '@/lib/tenant';
import { logger } from '@/lib/logger';

const AUTH_SECRET = process.env.AUTH_SECRET || '';

function signState(state: string) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(state).digest('hex');
}

const googleJWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function redirectLogin(origin: string, error: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
}

export async function GET(req: NextRequest) {
  const origin = process.env.APP_URL || req.nextUrl.origin;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const ip = getClientIp(req);

  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');
  if (!code) {
    return redirectLogin(origin, 'Login Google dibatalkan');
  }

  const oauthStateCookie = req.cookies.get('oauth_state')?.value;
  if (!oauthStateCookie || !stateParam) {
    return redirectLogin(origin, 'Sesi login tidak valid');
  }
  const [cookieRaw, cookieSig] = oauthStateCookie.split('.');
  const expectedSig = signState(cookieRaw);
  if (
    !cookieRaw ||
    !cookieSig ||
    !crypto.timingSafeEqual(Buffer.from(cookieSig), Buffer.from(expectedSig)) ||
    cookieRaw !== stateParam
  ) {
    return redirectLogin(origin, 'State tidak valid, coba login lagi');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.id_token) {
      return redirectLogin(origin, 'Gagal menukar kode otorisasi Google');
    }

    let payload: { email?: string; email_verified?: boolean; name?: string; picture?: string };
    try {
      const result = await jwtVerify(tokens.id_token, googleJWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      payload = result.payload as typeof payload;
    } catch {
      return redirectLogin(origin, 'Token Google tidak valid');
    }

    if (!payload.email || !payload.email_verified) {
      return redirectLogin(origin, 'Email Google belum diverifikasi');
    }

    const email = payload.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await logAudit(null, 'SSO_GOOGLE_UNLINKED', 'AUTH', { newData: { email } }, req);
      return redirectLogin(origin, `Tidak ada akun DTMS dengan email ${email}. Hubungi admin untuk menghubungkan akun Anda.`);
    }
    if (user.status !== 'ACTIVE') {
      return redirectLogin(origin, 'Akun Anda tidak aktif');
    }

    await recordLoginAttempt(email, ip, true);

    if (user.totpEnabled) {
      const twoFactorToken = await signTwoFactorToken(user.id);
      const r = NextResponse.redirect(`${origin}/login?twoFactorToken=${encodeURIComponent(twoFactorToken)}`);
      r.cookies.delete('oauth_state');
      return r;
    }

    await setSession({ id: user.id, name: user.name, username: user.username, role: user.role, tenantId: user.tenantId, branchId: user.branchId, pwdVersion: user.pwdVersion });

    const target = user.mustChangePassword
      ? '/account/password?first=1'
      : user.role === 'DRIVER'
        ? '/driver'
        : user.role === 'SUPER_ADMIN'
          ? '/tenants'
          : '/dashboard';
    const response = NextResponse.redirect(`${origin}${target}`);
    response.cookies.delete('oauth_state');
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true } });
      if (tenant) {
        const cookie = setTenantCookie(tenant.slug);
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
          path: cookie.path,
          maxAge: cookie.maxAge,
        });
      }
    }

    await logAudit(null, 'SSO_GOOGLE_LOGIN', 'AUTH', { newData: { email, username: user.username } }, req);
    return response;
  } catch (e) {
    logger.error('google_callback', 'Google OAuth callback error', { error: String(e) });
    const r = redirectLogin(origin, 'Terjadi kesalahan saat login Google');
    r.cookies.delete('oauth_state');
    return r;
  }
}
