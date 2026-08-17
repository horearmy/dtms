import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, drivers: true, shipments: true, vehicles: true, customers: true, geofences: true } },
      users: {
        select: { id: true, name: true, username: true, role: true, status: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      drivers: {
        select: { id: true, employeeId: true, name: true, phone: true, status: true },
        orderBy: { name: 'asc' },
        take: 50,
      },
      shipments: {
        select: { id: true, trackingNumber: true, origin: true, destination: true, status: true, serviceType: true, weight: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      vehicles: {
        select: { id: true, vehicleNumber: true, type: true, status: true, capacity: true },
        orderBy: { vehicleNumber: 'asc' },
        take: 50,
      },
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  }

  const [shipmentStats] = await prisma.$queryRaw<{ total: bigint; delivered: bigint; intransit: bigint }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
      COUNT(*) FILTER (WHERE status IN ('IN_TRANSIT','OUT_FOR_DELIVERY','ARRIVED_AT_HUB'))::int AS intransit
    FROM "Shipment"
    WHERE "tenantId" = ${id}
  `;

  return NextResponse.json({ ...tenant, shipmentStats });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, primaryColor, secondaryColor, accentColor, domain, plan, contactName, contactEmail, contactPhone, maxUsers, maxDrivers, maxShipments, active } = body;

  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  }

  if (domain && domain !== existing.domain) {
    const domainTaken = await prisma.tenant.findUnique({ where: { domain } });
    if (domainTaken) {
      return NextResponse.json({ error: 'Domain sudah digunakan' }, { status: 409 });
    }
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).slice(0, 100) }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(accentColor !== undefined && { accentColor }),
      ...(domain !== undefined && { domain: domain ? String(domain).slice(0, 100) : null }),
      ...(plan !== undefined && { plan }),
      ...(contactName !== undefined && { contactName: contactName ? String(contactName).slice(0, 100) : null }),
      ...(contactEmail !== undefined && { contactEmail: contactEmail ? String(contactEmail).slice(0, 150) : null }),
      ...(contactPhone !== undefined && { contactPhone: contactPhone ? String(contactPhone).slice(0, 20) : null }),
      ...(maxUsers !== undefined && { maxUsers }),
      ...(maxDrivers !== undefined && { maxDrivers }),
      ...(maxShipments !== undefined && { maxShipments }),
      ...(active !== undefined && { active }),
    },
  });

  return NextResponse.json(tenant);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  }

  if (existing.slug === 'default') {
    return NextResponse.json({ error: 'Tidak dapat menghapus tenant default' }, { status: 400 });
  }

  await prisma.tenant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
