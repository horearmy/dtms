import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { clearSuperAdminSession, revokeSuperAdminSessionByToken, SUPERADMIN_COOKIE } from '@/lib/superadmin-auth';
import { logAudit } from '@/lib/api-guard';

export async function POST() {
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
  return NextResponse.json({ ok: true });
}
