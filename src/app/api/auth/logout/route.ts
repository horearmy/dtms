import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';
import { clearSuperAdminSession } from '@/lib/superadmin-auth';

export async function POST() {
  await clearSession();
  await clearSuperAdminSession();
  return NextResponse.json({ ok: true });
}
