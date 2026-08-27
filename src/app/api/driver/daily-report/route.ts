import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DAILY_REPORT.CREATE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

    const body = await req.json();
    const { reportDate, deliveredCount, failedCount, rescheduledCount, fuelLiter, notes } = body;

    const dateInput = reportDate ? new Date(reportDate) : new Date();
    if (isNaN(dateInput.getTime())) {
      return NextResponse.json({ error: 'Tanggal laporan tidak valid' }, { status: 400 });
    }
    const reportDateStart = new Date(dateInput);
    reportDateStart.setHours(0, 0, 0, 0);

    const report = await prisma.dailyReport.upsert({
      where: {
        driverId_reportDate: { driverId: driver.id, reportDate: reportDateStart },
      },
      create: {
        driverId: driver.id,
        reportDate: reportDateStart,
        deliveredCount: deliveredCount || 0,
        failedCount: failedCount || 0,
        rescheduledCount: rescheduledCount || 0,
        fuelLiter: fuelLiter || 0,
        notes: notes || null,
      },
      update: {
        deliveredCount: deliveredCount || 0,
        failedCount: failedCount || 0,
        rescheduledCount: rescheduledCount || 0,
        fuelLiter: fuelLiter || 0,
        notes: notes || null,
      },
    });

    return NextResponse.json(report);
  });
}

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.DAILY_REPORT.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
    if (!driver) return NextResponse.json({ reports: [] });

    const reports = await prisma.dailyReport.findMany({
      where: { driverId: driver.id },
      orderBy: { reportDate: 'desc' },
      take: 30,
    });

    return NextResponse.json({ reports });
  });
}
