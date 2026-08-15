import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard('DRIVER', 'SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR');
  if (error) return error;

  const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
  if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

  const reports = await prisma.dailyReport.findMany({
    where: { driverId: driver.id },
    orderBy: { reportDate: 'desc' },
  });

  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('DRIVER', 'SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;

  const driver = await prisma.driver.findUnique({ where: { userId: session!.id } });
  if (!driver) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai driver' }, { status: 404 });

  const body = await req.json();
  if (!body?.reportDate) {
    return NextResponse.json({ error: 'Tanggal laporan wajib diisi' }, { status: 400 });
  }

  const reportDate = new Date(body.reportDate);
  if (Number.isNaN(reportDate.getTime())) {
    return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 });
  }

  const data = {
    deliveredCount: Number(body.deliveredCount) || 0,
    failedCount: Number(body.failedCount) || 0,
    rescheduledCount: Number(body.rescheduledCount) || 0,
    fuelLiter: body.fuelLiter != null && body.fuelLiter !== '' ? Number(body.fuelLiter) : null,
    notes: body.notes || null,
  };

  const report = await prisma.dailyReport.upsert({
    where: { driverId_reportDate: { driverId: driver.id, reportDate } },
    update: data,
    create: { driverId: driver.id, reportDate, ...data },
  });

  await logAudit(session, 'SAVE_DAILY_REPORT', 'REPORT', { newData: { driverName: driver.name, reportDate: reportDate.toISOString().slice(0, 10), delivered: data.deliveredCount, failed: data.failedCount } }, req);
  return NextResponse.json({ report }, { status: 201 });
}
