import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant, guardPlanLimit } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { driverScore } from '@/lib/scoring';
import { ON_ROAD_STATUSES } from '@/lib/constants';
import { validatePassword, BCRYPT_COST } from '@/lib/security';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DRIVER.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));

    const total = await prisma.driver.count();
    const drivers = await prisma.driver.findMany({
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { username: true } }, _count: { select: { assignments: true } } },
    });

    // Generate next employee ID: DRV-XXX (3-digit zero-padded)
    const lastDriver = await prisma.driver.findFirst({
      orderBy: { id: 'desc' },
      select: { employeeId: true },
    });
    let nextNum = total + 1;
    if (lastDriver?.employeeId) {
      const match = lastDriver.employeeId.match(/(\d+)$/);
      if (match) nextNum = Math.max(nextNum, parseInt(match[1], 10) + 1);
    }
    const nextEmployeeId = `DRV-${String(nextNum).padStart(3, '0')}`;

    const driverIds = drivers.map(d => d.id);
    const [scores, activeTrips] = await Promise.all([
      Promise.all(driverIds.map(id => driverScore(id))),
      prisma.deliveryAssignment.findMany({
        where: { driverId: { in: driverIds }, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
        select: { driverId: true, shipment: { select: { trackingNumber: true } } },
      }),
    ]);

    const tripMap = new Map<string, string>();
    for (const t of activeTrips) tripMap.set(t.driverId, t.shipment.trackingNumber);

    const scored = drivers.map((d, i) => ({
      ...d,
      stat: scores[i],
      busy: !!tripMap.get(d.id) || d.returning,
      activeTracking: tripMap.get(d.id) || null,
    }));
    return NextResponse.json({ items: scored, total, page, pageSize, nextEmployeeId });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DRIVER.CREATE);
  if (error) return error;
  const limitError = await guardPlanLimit(session, 'drivers');
  if (limitError) return limitError;
  return runWithTenant(session?.tenantId ?? null, async () => {
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
    if (password) {
      const { valid: pwValid, error: pwError } = validatePassword(password);
      if (!pwValid) return NextResponse.json({ error: pwError }, { status: 400 });
    }

    try {
      const driver = await prisma.$transaction(async (tx) => {
        let userId: string | undefined;
        if (username) {
          const existing = await tx.user.findFirst({ where: { username, tenantId: session?.tenantId ?? null } });
          if (existing) {
            throw new Error('USERNAME_DUPLICATE');
          }
          const user = await tx.user.create({
            data: {
              name: body.name,
              username,
              passwordHash: bcrypt.hashSync(password, BCRYPT_COST),
              role: 'DRIVER',
              status: 'ACTIVE',
              phone: body.phone,
              tenantId: session?.tenantId ?? null,
              pwdVersion: 1,
              mustChangePassword: false,
            },
          });
          userId = user.id;
        }
        return tx.driver.create({
          data: {
            employeeId: body.employeeId,
            name: body.name,
            phone: body.phone,
            photo: body.photo || null,
            status: body.status || 'ACTIVE',
            ...(userId ? { userId } : {}),
          },
        });
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
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'USERNAME_DUPLICATE') {
        return NextResponse.json({ error: `Username "${username}" sudah terdaftar. Pilih username lain.` }, { status: 400 });
      }
      if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
        return NextResponse.json({ error: 'Employee ID sudah terdaftar' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Gagal menyimpan driver' }, { status: 500 });
    }
  });
}