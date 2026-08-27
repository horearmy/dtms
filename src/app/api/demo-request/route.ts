import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/api-guard';
import { getClientIp, checkRateLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await checkRateLimit(`demo:${ip}`, 3, 3_600_000)) {
    return NextResponse.json({ error: 'Terlalu banyak request, coba lagi nanti' }, { status: 429 });
  }

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

    if (phone) {
      const e164 = /^\+[1-9]\d{7,14}$/;
      if (!e164.test(String(phone).trim())) {
        return NextResponse.json(
          { error: 'Format nomor telepon tidak valid (gunakan format internasional, mis. +628123456789)' },
          { status: 400 }
        );
      }
    }

    return runWithTenant(null, async () => {
      const demo = await prisma.demoRequest.create({
        data: {
          name: String(name).slice(0, 100),
          email: String(email).slice(0, 150),
          phone: phone ? String(phone).slice(0, 20) : null,
          company: String(company).slice(0, 150),
          message: message ? String(message).slice(0, 1000) : null,
          tenantId: null,
        },
      });

      const admins = await prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN_OPERASIONAL'] }, status: 'ACTIVE' },
        select: { id: true },
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            message: `Permohonan Demo baru dari ${demo.name} (${demo.company}). Silakan ditindaklanjuti.`,
            tenantId: null,
            metadata: { type: 'demo_request', demoRequestId: demo.id },
          })),
        });
      }

      return NextResponse.json({ ok: true });
    });
  } catch {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
