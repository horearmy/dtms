import { NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { generateRandomPassword } from '@/lib/security';

export async function GET() {
  const { error } = await guardPermission(PERMISSIONS.USER.CREATE);
  if (error) return error;
  return NextResponse.json({ password: generateRandomPassword(12) });
}
