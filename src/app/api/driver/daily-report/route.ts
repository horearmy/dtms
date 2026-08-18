import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

  const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
  if (!driver) return NextResponse.json({ error: 'Driver tidak terdaftar' }, { status: 403 });

  const body = await req.json();
  const { deliveredCount, failedCount, rescheduledCount, fuelLiter, notes } = body;

  const report = await prisma.dailyReport.create({
    data: {
      tenantId: session?.tenantId || '',
      driverId: driver.id,
      date: new Date(),
      deliveredCount: deliveredCount || 0,
      failedCount: failedCount || 0,
      rescheduledCount: rescheduledCount || 0,
      fuelLiter: fuelLiter || 0,
      notes: notes || null,
    },
  });

  return NextResponse.json(report, { status: 201 });
}

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  const driver = await prisma.driver.findFirst({ where: { userId: session?.id } });
  if (!driver) return NextResponse.json({ reports: [] });

  const reports = await prisma.dailyReport.findMany({
    where: { driverId: driver.id },
    orderBy: { date: 'desc' },
    take: 30,
  });

  return NextResponse.json({ reports });
}
