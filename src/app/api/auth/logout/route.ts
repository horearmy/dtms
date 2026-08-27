import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { clearSuperAdminSession, revokeSuperAdminSessionByToken, SUPERADMIN_COOKIE } from '@/lib/superadmin-auth';
import { logAudit } from '@/lib/api-guard';

async function logout(req?: NextRequest) {
  const store = await cookies();
  const saToken = store.get(SUPERADMIN_COOKIE)?.value;
  if (saToken) {
    // Tandai sesi server-side revoked (Blueprint §13/§16)
    await revokeSuperAdminSessionByToken(saToken);
    const session = await getSession();
    await logAudit(
      session ? { id: session.id, name: session.name, username: session.username, role: session.role, tenantId: null, branchId: null } : null,
      'SUPERADMIN_SESSION_REVOKED',
      'AUTH',
      { newData: { scope: 'logout' } }
    ).catch(() => {});
  }
  await clearSession();
  await clearSuperAdminSession();
  const response = req
    ? NextResponse.redirect(new URL('/login', req.url))
    : NextResponse.json({ ok: true });
  // Hapus juga secara eksplisit agar cookie lama dengan path yang sama tidak tersisa.
  for (const name of ['dtms_token', SUPERADMIN_COOKIE, 'dtms_csrf']) {
    response.cookies.set(name, '', { expires: new Date(0), maxAge: 0, path: '/' });
  }
  return response;
}

export async function GET(req: NextRequest) {
  return logout(req);
}

export async function POST() {
  return logout();
}
