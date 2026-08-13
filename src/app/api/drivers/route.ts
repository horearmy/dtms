import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { driverScore } from '@/lib/scoring';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR'];

export async function GET() {
  const { error } = await guard(...MANAGE);
  if (error) return error;
  const drivers = await prisma.driver.findMany({
    orderBy: { name: 'asc' },
    include: { user: { select: { username: true } }, _count: { select: { assignments: true } } },
  });
  const scored = [];
  for (const d of drivers) {
    const stat = await driverScore(d.id);
    scored.push({ ...d, stat });
  }
  return NextResponse.json(scored);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard(...MANAGE);
  if (error) return error;
  const body = await req.json();
  if (!body.employeeId || !body.name || !body.phone) {
    return NextResponse.json({ error: 'Employee ID, nama, dan telepon wajib diisi' }, { status: 400 });
  }
  try {
    const driver = await prisma.driver.create({
      data: { employeeId: body.employeeId, name: body.name, phone: body.phone, status: body.status || 'ACTIVE' },
    });
    await logAudit(session, 'CREATE_DRIVER', 'DRIVER', driver.name);
    return NextResponse.json(driver, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Employee ID sudah terdaftar' }, { status: 400 });
  }
}