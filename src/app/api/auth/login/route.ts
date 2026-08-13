import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body || {};
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }
    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
    }

    await setSession({ id: user.id, name: user.name, username: user.username, role: user.role });
    return NextResponse.json({ id: user.id, name: user.name, role: user.role });
  } catch (e) {
    console.error('login error', e);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}