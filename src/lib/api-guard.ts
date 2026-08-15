import { NextRequest, NextResponse } from 'next/server';
import { getSession, type SessionUser } from './auth';

export async function guard(
  ...roles: string[]
): Promise<{ session: SessionUser | null; error: NextResponse | null }> {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 }) };
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    return { session, error: NextResponse.json({ error: 'Tidak memiliki akses' }, { status: 403 }) };
  }
  return { session, error: null };
}

type AuditData = string | { oldData?: unknown; newData?: unknown };

function json(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return undefined;
  }
}

export async function logAudit(
  session: SessionUser | null,
  action: string,
  module: string,
  data?: AuditData,
  req?: NextRequest
) {
  try {
    const { prisma } = await import('./prisma');
    const oldData = typeof data === 'object' ? json(data.oldData) : undefined;
    const newData = typeof data === 'object' ? json(data.newData) : typeof data === 'string' ? data : undefined;
    await prisma.auditLog.create({
      data: {
        userId: session?.id,
        action,
        module,
        oldData,
        newData,
        ip: req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req?.headers.get('x-real-ip') ?? null,
        method: req?.method ?? null,
        path: req?.nextUrl?.pathname ?? null,
        userAgent: req?.headers.get('user-agent') ?? null,
      },
    });
  } catch {
    // jangan menggagalkan request utama
  }
}
