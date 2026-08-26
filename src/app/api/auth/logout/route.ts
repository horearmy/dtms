import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/auth';
import { clearSuperAdminSession, SUPERADMIN_COOKIE } from '@/lib/superadmin-auth';
import { logAudit } from '@/lib/api-guard';

export async function POST() {
  const store = await cookies();
  const hadSaSession = !!store.get(SUPERADMIN_COOKIE)?.value;
  if (hadSaSession) {
    const session = await getSession();
    await logAudit(
      session ? { id: session.id, name: session.name, username: session.username, role: session.role, tenantId: null, branchId: null } : null,
      'SUPERADMIN_SESSION_REVOKED',
      'AUTH'
    ).catch(() => {});
  }
  await clearSession();
  await clearSuperAdminSession();
  return NextResponse.json({ ok: true });
}
