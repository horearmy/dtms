import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';
import { driverScore } from '@/lib/scoring';
import { ON_ROAD_STATUSES } from '@/lib/constants';

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
    const trip = await prisma.deliveryAssignment.findFirst({
      where: { driverId: d.id, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
      select: { shipment: { select: { trackingNumber: true } } },
    });
    scored.push({ ...d, stat, busy: !!trip || d.returning, activeTracking: trip?.shipment.trackingNumber || null });
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

  const username = body.username?.toString().trim().toLowerCase() || '';
  const password = body.password?.toString() || '';
  if (username && !password) {
    return NextResponse.json({ error: 'Password wajib diisi untuk membuat akun login' }, { status: 400 });
  }
  if (password && !username) {
    return NextResponse.json({ error: 'Username wajib diisi untuk membuat akun login' }, { status: 400 });
  }

  try {
    let userId: string | undefined;
    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return NextResponse.json(
          { error: `Username "${username}" sudah terdaftar. Pilih username lain.` },
          { status: 400 }
        );
      }
      const user = await prisma.user.create({
        data: {
          name: body.name,
          username,
          passwordHash: bcrypt.hashSync(password, 10),
          role: 'DRIVER',
          status: 'ACTIVE',
          phone: body.phone,
          pwdVersion: 1,
          mustChangePassword: false,
        },
      });
      userId = user.id;
    }
    const driver = await prisma.driver.create({
      data: {
        employeeId: body.employeeId,
        name: body.name,
        phone: body.phone,
        photo: body.photo || null,
        status: body.status || 'ACTIVE',
        ...(userId ? { userId } : {}),
      },
    });
    await logAudit(
      session,
      'CREATE_DRIVER',
      'DRIVER',
      { newData: { employeeId: driver.employeeId, name: driver.name, phone: driver.phone, akun: username || null } },
      req
    );
    return NextResponse.json(driver, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Employee ID sudah terdaftar' }, { status: 400 });
  }
}