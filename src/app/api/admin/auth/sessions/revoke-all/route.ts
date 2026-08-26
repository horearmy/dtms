import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

/** POST /api/admin/auth/sessions/revoke-all — Blueprint §36 */
export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  const r = await prisma.adminSession.updateMany({
    where: { userId: session!.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logAudit(session, 'SUPERADMIN_SESSION_REVOKED', 'AUTH', { newData: { scope: 'all', count: r.count } }, req);
  return NextResponse.json({ ok: true, revoked: r.count });
}
