import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status') || '';
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, drivers: true, shipments: true } },
      subscription: {
        select: {
          id: true, status: true, billingCycle: true, currentPeriodStart: true, currentPeriodEnd: true, cancelledAt: true,
          plan: { select: { code: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }
  const { name, slug } = body;
  const code = body.code as string | undefined;
  const status = body.status as string | undefined;
  const primaryColor = body.primaryColor as string | undefined;
  const secondaryColor = body.secondaryColor as string | undefined;
  const accentColor = body.accentColor as string | undefined;
  const domain = body.domain as string | undefined;
  const plan = body.plan as string | undefined;
  const timezone = body.timezone as string | undefined;
  const locale = body.locale as string | undefined;
  const currency = body.currency as string | undefined;
  const contactName = body.contactName as string | undefined;
  const contactEmail = body.contactEmail as string | undefined;
  const contactPhone = body.contactPhone as string | undefined;
  const logoUrl = body.logoUrl as string | undefined;
  const faviconUrl = body.faviconUrl as string | undefined;
  const maxUsers = body.maxUsers as number | undefined;
  const maxDrivers = body.maxDrivers as number | undefined;
  const maxShipments = body.maxShipments as number | undefined;

  if (!name || !slug) {
    return NextResponse.json({ error: 'Nama dan slug wajib diisi' }, { status: 400 });
  }

  const slugStr = String(slug);
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slugStr)) {
    return NextResponse.json({ error: 'Slug hanya boleh huruf kecil, angka, dan strip' }, { status: 400 });
  }

  const existing = await prisma.tenant.findUnique({ where: { slug: slugStr } });
  if (existing) {
    return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 });
  }

  const codeStr = code ? String(code) : null;
  if (codeStr) {
    const existingCode = await prisma.tenant.findUnique({ where: { code: codeStr } });
    if (existingCode) {
      return NextResponse.json({ error: 'Kode tenant sudah digunakan' }, { status: 409 });
    }
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: String(name).slice(0, 100),
      slug: slugStr.slice(0, 50),
      code: codeStr ? codeStr.slice(0, 20) : null,
      status: (status as 'ACTIVE' | 'SUSPENDED') || 'ACTIVE',
      primaryColor: primaryColor || '#2563eb',
      secondaryColor: secondaryColor || '#1e40af',
      accentColor: accentColor || '#3b82f6',
      domain: domain ? String(domain).slice(0, 100) : null,
      plan: plan || 'FREE',
      timezone: timezone || 'Asia/Jakarta',
      locale: locale || 'id-ID',
      currency: currency || 'IDR',
      contactName: contactName ? String(contactName).slice(0, 100) : null,
      contactEmail: contactEmail ? String(contactEmail).slice(0, 150) : null,
      contactPhone: contactPhone ? String(contactPhone).slice(0, 20) : null,
      logoUrl: logoUrl ? String(logoUrl).slice(0, 500) : null,
      faviconUrl: faviconUrl ? String(faviconUrl).slice(0, 500) : null,
      maxUsers: maxUsers ?? 5,
      maxDrivers: maxDrivers ?? 10,
      maxShipments: maxShipments ?? 100,
    },
  });

  return NextResponse.json(tenant, { status: 201 });
}
