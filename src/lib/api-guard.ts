import { NextResponse } from 'next/server';
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

export async function logAudit(session: SessionUser | null, action: string, module: string, newData?: string) {
  try {
    const { prisma } = await import('./prisma');
    await prisma.auditLog.create({
      data: { userId: session?.id, action, module, newData },
    });
  } catch {
    // jangan menggagalkan request utama
  }
}