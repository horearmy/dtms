import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { ON_ROAD_STATUSES } from '@/lib/constants';
import { validatePassword } from '@/lib/security';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.DRIVER.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: { user: { select: { username: true } }, _count: { select: { assignments: true } } },
    });
    if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });

    // kendaraan yang sedang dipakai (penugasan terbaru)
    const latestAssignment = await prisma.deliveryAssignment.findFirst({
      where: { driverId: id },
      orderBy: { assignedAt: 'desc' },
      include: { vehicle: true },
    });

    // shipment yang sedang aktif (status perjalanan)
    const activeAssignment = await prisma.deliveryAssignment.findFirst({
      where: { driverId: id, shipment: { status: { in: ON_ROAD_STATUSES as ShipmentStatus[] } } },
      orderBy: { assignedAt: 'desc' },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
            origin: true,
            destination: true,
            originLat: true,
            originLng: true,
            destLat: true,
            destLng: true,
            receiver: { select: { name: true, address: true, city: true } },
          },
        },
      },
    });

    // posisi GPS terakhir driver
    const gps = await prisma.gpsLog.findFirst({
      where: { driverId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      driver: {
        id: driver.id,
        employeeId: driver.employeeId,
        name: driver.name,
        phone: driver.phone,
        photo: driver.photo,
        status: driver.status,
        returning: driver.returning,
        returnedAt: driver.returnedAt,
        returnStartedAt: driver.returnStartedAt,
        username: driver.user?.username || null,
        assignmentCount: driver._count.assignments,
        vehicle: latestAssignment?.vehicle
          ? {
              id: latestAssignment.vehicle.id,
              vehicleNumber: latestAssignment.vehicle.vehicleNumber,
              type: latestAssignment.vehicle.type,
              status: latestAssignment.vehicle.status,
              returning: latestAssignment.vehicle.returning,
              totalDistanceKm: latestAssignment.vehicle.totalDistanceKm,
            }
          : null,
        gps: gps
          ? {
              latitude: gps.latitude,
              longitude: gps.longitude,
              speed: gps.speed,
              battery: gps.battery,
              createdAt: gps.createdAt,
            }
          : null,
        active: activeAssignment?.shipment
          ? {
              id: activeAssignment.shipment.id,
              trackingNumber: activeAssignment.shipment.trackingNumber,
              status: activeAssignment.shipment.status,
              origin: activeAssignment.shipment.origin,
              destination: activeAssignment.shipment.destination,
              originLat: activeAssignment.shipment.originLat,
              originLng: activeAssignment.shipment.originLng,
              destLat: activeAssignment.shipment.destLat,
              destLng: activeAssignment.shipment.destLng,
              receiverName: activeAssignment.shipment.receiver.name,
              receiverAddress: activeAssignment.shipment.receiver.address,
              receiverCity: activeAssignment.shipment.receiver.city,
            }
          : null,
      },
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.DRIVER.UPDATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();

    const driver = await prisma.driver.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, tenantId: true, role: true } } } });
    if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });

    const username = body.username?.toString().trim().toLowerCase() || '';
    const password = body.password?.toString() || '';

    let newUserId: string | undefined;

    if (password) {
      const { valid: pwValid, error: pwError } = validatePassword(password);
      if (!pwValid) return NextResponse.json({ error: pwError }, { status: 400 });
    }

    try {
      if (password) {
        const hash = bcrypt.hashSync(password, 10);
        if (driver.userId) {
          await prisma.user.update({ where: { id: driver.userId }, data: { passwordHash: hash } });
        } else {
          if (!username) {
            return NextResponse.json({ error: 'Username wajib diisi untuk membuat akun login' }, { status: 400 });
          }
          const existing = await prisma.user.findFirst({ where: { username, tenantId: session?.tenantId ?? null } });
          if (existing) {
            return NextResponse.json({ error: `Username "${username}" sudah terdaftar. Pilih username lain.` }, { status: 400 });
          }
          const user = await prisma.user.create({
            data: {
              name: body.name || driver.name,
              username,
              passwordHash: hash,
              role: 'DRIVER',
              status: 'ACTIVE',
              phone: body.phone || driver.phone,
              pwdVersion: 1,
              mustChangePassword: false,
            },
          });
          newUserId = user.id;
        }
      }
      const updated = await prisma.driver.update({
        where: { id },
        data: {
          name: body.name,
          phone: body.phone,
          photo: body.photo,
          status: body.status,
          ...(newUserId ? { userId: newUserId } : {}),
        },
      });
      await logAudit(session, 'UPDATE_DRIVER', 'DRIVER', {
        oldData: { id: driver.id, name: driver.name, phone: driver.phone, status: driver.status, userId: driver.userId },
        newData: { id: updated.id, name: updated.name, phone: updated.phone, status: updated.status },
      }, req);
      return NextResponse.json(updated);
    } catch {
      return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.DRIVER.DELETE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    try {
      const before = await prisma.driver.findUnique({ where: { id } });
      await prisma.driver.delete({ where: { id } });
      await logAudit(session, 'DELETE_DRIVER', 'DRIVER', { oldData: before }, req);
    } catch {
      return NextResponse.json({ error: 'Tidak dapat menghapus driver' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  });
}