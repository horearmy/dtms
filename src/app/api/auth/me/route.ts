import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/constants';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { ...session, roleLabel: ROLE_LABELS[session.role] || session.role },
  });
}