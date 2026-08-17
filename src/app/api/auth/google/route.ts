import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const AUTH_SECRET = process.env.AUTH_SECRET || '';

function signState(state: string) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(state).digest('hex');
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${req.nextUrl.origin}/login?error=${encodeURIComponent('SSO Google belum dikonfigurasi')}`);
  }
  const appUrl = process.env.APP_URL || req.nextUrl.origin;

  const stateBytes = crypto.randomBytes(32);
  const stateRaw = stateBytes.toString('hex');
  const stateSig = signState(stateRaw);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: stateRaw,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.cookies.set('oauth_state', `${stateRaw}.${stateSig}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
