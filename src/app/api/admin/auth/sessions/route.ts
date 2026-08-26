import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { logAudit } from '@/lib/api-guard';

/** GET /api/admin/auth/sessions — daftar perangkat & sesi aktif (Blueprint §17) */
export async function GET() {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  const rows = await prisma.adminSession.findMany({
    where: { userId: session!.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActivityAt: 'desc' },
    select: {
      id: true, ip: true, userAgent: true, authenticationMethod: true,
      riskLevel: true, createdAt: true, lastActivityAt: true, expiresAt: true,
    },
  });

  return NextResponse.json({ items: rows });
}

/** DELETE /api/admin/auth/sessions?id=...  — revoke satu sesi */
export async function DELETE(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

  const r = await prisma.adminSession.updateMany({
    where: { id, userId: session!.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (r.count === 0) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });

  await logAudit(session, 'SUPERADMIN_SESSION_REVOKED', 'AUTH', { newData: { sessionId: id } }, req);
  return NextResponse.json({ ok: true });
}
