import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
  const body = await req.json();

  const driver = await prisma.driver.findUnique({ where: { id }, include: { user: true } });
  if (!driver) return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });

  const username = body.username?.toString().trim().toLowerCase() || '';
  const password = body.password?.toString() || '';

  let newUserId: string | undefined;

  try {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      if (driver.userId) {
        await prisma.user.update({ where: { id: driver.userId }, data: { passwordHash: hash } });
      } else {
        if (!username) {
          return NextResponse.json({ error: 'Username wajib diisi untuk membuat akun login' }, { status: 400 });
        }
        const existing = await prisma.user.findUnique({ where: { username } });
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
    await logAudit(session, 'UPDATE_DRIVER', 'DRIVER', driver.name);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Driver tidak ditemukan' }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  try {
    await prisma.driver.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: 'Tidak dapat menghapus driver' }, { status: 400 });
  }
  await logAudit(session, 'DELETE_DRIVER', 'DRIVER', id);
  return NextResponse.json({ ok: true });
}