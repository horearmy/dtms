import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { logger } from '@/lib/logger';
import { bumpSecurityVersion, bumpSecurityVersionFromCookie } from '@/lib/superadmin-auth';

/** GET /api/admin/auth/passkey — daftar passkey aktif (Blueprint §32) */
export async function GET() {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  const rows = await prisma.passkeyCredential.findMany({
    where: { userId: session!.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, deviceName: true, transports: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ items: rows });
}

/** DELETE /api/admin/auth/passkey?id=... — hapus (revoke) satu passkey */
export async function DELETE(req: NextRequest) {
  try {
    const { session, error } = await guard('SUPER_ADMIN');
    if (error) return error;

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

    const r = await prisma.passkeyCredential.updateMany({
      where: { id, userId: session!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (r.count === 0) return NextResponse.json({ error: 'Passkey tidak ditemukan' }, { status: 404 });

    // Blueprint §13: cabut sesi privileged lain setelah passkey dihapus
    await bumpSecurityVersionFromCookie(session!.id);
    await logAudit(session, 'SUPERADMIN_PASSKEY_REMOVED', 'AUTH', { newData: { passkeyId: id } }, req);
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('Passkey delete error', { context: 'passkey', error: String(e) });
    return NextResponse.json({ error: `Passkey delete failed: ${String(e)}` }, { status: 500 });
  }
}
