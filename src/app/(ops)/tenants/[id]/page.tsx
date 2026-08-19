import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TenantDetail from './TenantDetail';

export const metadata: Metadata = { title: 'Detail Tenant | DTMS' };

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) redirect('/dashboard');

  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, drivers: true, shipments: true, vehicles: true, customers: true, geofences: true } },
      subscription: {
        include: { plan: true },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
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

  if (!tenant) notFound();

  const [shipmentStats] = await prisma.$queryRaw<{ total: bigint; delivered: bigint; intransit: bigint }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
      COUNT(*) FILTER (WHERE status IN ('IN_TRANSIT','OUT_FOR_DELIVERY','ARRIVED_AT_HUB'))::int AS intransit
    FROM "Shipment"
    WHERE "tenantId" = ${id}
  `;

  const serialized = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    code: tenant.code,
    logoUrl: tenant.logoUrl,
    faviconUrl: tenant.faviconUrl,
    primaryColor: tenant.primaryColor,
    secondaryColor: tenant.secondaryColor,
    accentColor: tenant.accentColor,
    domain: tenant.domain,
    plan: tenant.plan,
    status: tenant.status,
    timezone: tenant.timezone,
    locale: tenant.locale,
    currency: tenant.currency,
    contactName: tenant.contactName,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    maxUsers: tenant.maxUsers,
    maxDrivers: tenant.maxDrivers,
    maxShipments: tenant.maxShipments,
    active: tenant.active,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    _count: tenant._count,
    subscription: tenant.subscription ? {
      id: tenant.subscription.id,
      status: tenant.subscription.status,
      billingCycle: tenant.subscription.billingCycle,
      currentPeriodStart: tenant.subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: tenant.subscription.currentPeriodEnd.toISOString(),
      cancelledAt: tenant.subscription.cancelledAt?.toISOString() ?? null,
      plan: { code: tenant.subscription.plan.code, name: tenant.subscription.plan.name },
    } : null,
    invoices: tenant.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      subtotal: inv.subtotal,
      tax: inv.tax,
      total: inv.total,
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
    users: tenant.users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    drivers: tenant.drivers,
    shipments: tenant.shipments.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    vehicles: tenant.vehicles,
    shipmentStats: {
      total: Number(shipmentStats?.total ?? 0),
      delivered: Number(shipmentStats?.delivered ?? 0),
      intransit: Number(shipmentStats?.intransit ?? 0),
    },
  };

  return (
    <div>
      <TenantDetail tenant={serialized} />
    </div>
  );
}
