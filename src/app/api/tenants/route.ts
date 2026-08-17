import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, drivers: true, shipments: true } } },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug, primaryColor, secondaryColor, accentColor, domain, plan, contactName, contactEmail, contactPhone, maxUsers, maxDrivers, maxShipments } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'Nama dan slug wajib diisi' }, { status: 400 });
  }

  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    return NextResponse.json({ error: 'Slug hanya boleh huruf kecil, angka, dan strip' }, { status: 400 });
  }

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 });
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: String(name).slice(0, 100),
      slug: String(slug).slice(0, 50),
      primaryColor: primaryColor || '#2563eb',
      secondaryColor: secondaryColor || '#1e40af',
      accentColor: accentColor || '#3b82f6',
      domain: domain ? String(domain).slice(0, 100) : null,
      plan: plan || 'FREE',
      contactName: contactName ? String(contactName).slice(0, 100) : null,
      contactEmail: contactEmail ? String(contactEmail).slice(0, 150) : null,
      contactPhone: contactPhone ? String(contactPhone).slice(0, 20) : null,
      maxUsers: maxUsers || 5,
      maxDrivers: maxDrivers || 10,
      maxShipments: maxShipments || 100,
    },
  });

  return NextResponse.json(tenant, { status: 201 });
}
