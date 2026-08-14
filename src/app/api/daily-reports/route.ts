import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR', 'MANAGEMENT');
  if (error) return error;

  const reports = await prisma.dailyReport.findMany({
    orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    include: { driver: { select: { id: true, name: true, employeeId: true } } },
  });

  return NextResponse.json({ reports });
}
