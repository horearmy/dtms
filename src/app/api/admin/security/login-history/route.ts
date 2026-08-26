import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

/** GET /api/admin/security/login-history — riwayat login SA dari audit (Blueprint §30) */
export async function GET() {
  const { session, error } = await guard('SUPER_ADMIN');
  if (error) return error;

  const rows = await prisma.auditLog.findMany({
    where: {
      userId: session!.id,
      action: { in: ['SUPERADMIN_SESSION_CREATED', 'SUPERADMIN_LOGIN_FAILED', 'SUPERADMIN_MFA_FAILED', 'SUPERADMIN_SESSION_REVOKED', 'SUPERADMIN_LOGIN_BLOCKED', 'SUPERADMIN_SECRET_FAILED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, action: true, ip: true, userAgent: true, newData: true, createdAt: true },
  });

  return NextResponse.json({
    items: rows.map((r) => {
      let reason = '';
      try { const d = r.newData ? JSON.parse(r.newData) : {}; reason = d.reason || d.scope || ''; } catch {}
      return { id: r.id, action: r.action, ip: r.ip, userAgent: r.userAgent, reason, createdAt: r.createdAt };
    }),
  });
}
