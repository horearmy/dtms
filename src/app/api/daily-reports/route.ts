import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.DAILY_REPORT.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const reports = await prisma.dailyReport.findMany({
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
      include: { driver: { select: { id: true, name: true, employeeId: true } } },
    });

    return NextResponse.json({ reports });
  });
}
