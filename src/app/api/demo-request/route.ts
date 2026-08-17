import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, company, message } = body;

    if (!name || !email || !company) {
      return NextResponse.json(
        { error: 'Nama, email, dan perusahaan wajib diisi' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      );
    }

    await prisma.demoRequest.create({
      data: {
        name: String(name).slice(0, 100),
        email: String(email).slice(0, 150),
        phone: phone ? String(phone).slice(0, 20) : null,
        company: String(company).slice(0, 150),
        message: message ? String(message).slice(0, 1000) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
