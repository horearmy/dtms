import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { ExceptionStatus } from '@prisma/client';

type DrillType =
  | 'tenants'
  | 'shipments_by_status'
  | 'shipments_active'
  | 'sla_breached'
  | 'exceptions_open'
  | 'revenue_by_tenant';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  const type = req.nextUrl.searchParams.get('type') as DrillType | null;
  const status = req.nextUrl.searchParams.get('status');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 200);

  if (!type) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 });
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const where = session?.tenantId ? { tenantId: session.tenantId } as Record<string, any> : {} as Record<string, any>;

    switch (type) {
      case 'tenants': {
        const tenants = await prisma.tenant.findMany({
          where,
          select: {
            id: true, name: true, status: true, plan: true, createdAt: true,
            _count: { select: { users: true, drivers: true, customers: true, shipments: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return NextResponse.json({
          title: 'Daftar Tenant',
          subtitle: `${tenants.length} tenant`,
          columns: ['name', 'status', 'plan', 'users', 'drivers', 'shipments', 'createdAt'],
          rows: tenants.map((t) => ({
            name: t.name, status: t.status, plan: t.plan || 'FREE',
            users: t._count.users, drivers: t._count.drivers, shipments: t._count.shipments,
            createdAt: t.createdAt.toISOString(),
          })),
          totalLabel: 'Total Tenants',
          totalValue: tenants.length,
        });
      }

      case 'shipments_by_status': {
        if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 });
        const shipments = await prisma.shipment.findMany({
          where: { ...where, status: status as any },
          select: {
            id: true, trackingNumber: true, status: true, serviceType: true, origin: true, destination: true, createdAt: true,
            sender: { select: { name: true } },
            assignments: { select: { driver: { select: { name: true } }, vehicle: { select: { vehicleNumber: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return NextResponse.json({
          title: `Shipment — ${status.replace(/_/g, ' ')}`,
          subtitle: `${shipments.length} shipment`,
          columns: ['trackingNumber', 'status', 'serviceType', 'sender', 'origin', 'destination', 'driver', 'createdAt'],
          rows: shipments.map((s) => ({
            trackingNumber: s.trackingNumber, status: s.status, serviceType: s.serviceType,
            sender: s.sender?.name || '-', origin: s.origin, destination: s.destination,
            driver: s.assignments?.[0]?.driver?.name || '-',
            createdAt: s.createdAt.toISOString(),
          })),
          totalLabel: 'Total',
          totalValue: shipments.length,
        });
      }

      case 'shipments_active': {
        const activeStatuses = ['ORDER_CREATED', 'WAREHOUSE_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'RESCHEDULED'];
        const shipments = await prisma.shipment.findMany({
          where: { ...where, status: { in: activeStatuses as any } },
          select: {
            id: true, trackingNumber: true, status: true, serviceType: true, origin: true, destination: true, createdAt: true,
            sender: { select: { name: true } },
            assignments: { select: { driver: { select: { name: true } }, vehicle: { select: { vehicleNumber: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return NextResponse.json({
          title: 'Active Shipments',
          subtitle: `${shipments.length} shipment aktif`,
          columns: ['trackingNumber', 'status', 'serviceType', 'sender', 'origin', 'destination', 'driver', 'createdAt'],
          rows: shipments.map((s) => ({
            trackingNumber: s.trackingNumber, status: s.status, serviceType: s.serviceType,
            sender: s.sender?.name || '-', origin: s.origin, destination: s.destination,
            driver: s.assignments?.[0]?.driver?.name || '-',
            createdAt: s.createdAt.toISOString(),
          })),
          totalLabel: 'Total Active',
          totalValue: shipments.length,
        });
      }

      case 'sla_breached': {
        const events = await prisma.slaEvent.findMany({
          where: { ...where, status: 'BREACHED' },
          select: {
            id: true, status: true, createdAt: true,
            shipment: { select: { trackingNumber: true, status: true, origin: true, destination: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return NextResponse.json({
          title: 'SLA Breached Shipments',
          subtitle: `${events.length} shipment melanggar SLA`,
          columns: ['trackingNumber', 'shipmentStatus', 'origin', 'destination', 'detectedAt'],
          rows: events.map((e) => ({
            trackingNumber: e.shipment?.trackingNumber || '-',
            shipmentStatus: e.shipment?.status?.replace(/_/g, ' ') || '-',
            origin: e.shipment?.origin || '-', destination: e.shipment?.destination || '-',
            detectedAt: e.createdAt.toISOString(),
          })),
          totalLabel: 'Total Breached',
          totalValue: events.length,
        });
      }

      case 'exceptions_open': {
        const exceptions = await prisma.exception.findMany({
          where: { ...where, status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] as ExceptionStatus[] } },
          select: {
            id: true, title: true, type: true, severity: true, status: true, createdAt: true, dueAt: true,
            shipment: { select: { trackingNumber: true } },
          },
          orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
          take: limit,
        });
        return NextResponse.json({
          title: 'Open Exceptions',
          subtitle: `${exceptions.length} exception aktif`,
          columns: ['title', 'type', 'severity', 'status', 'trackingNumber', 'createdAt', 'dueAt'],
          rows: exceptions.map((e) => ({
            title: e.title, type: e.type.replace(/_/g, ' '), severity: e.severity,
            status: e.status.replace(/_/g, ' '),
            trackingNumber: e.shipment?.trackingNumber || '-',
            createdAt: e.createdAt.toISOString(),
            dueAt: e.dueAt?.toISOString() || null,
          })),
          totalLabel: 'Total Open',
          totalValue: exceptions.length,
        });
      }

      case 'revenue_by_tenant': {
        const invoices = await prisma.invoice.groupBy({
          by: ['tenantId'],
          where: { ...where, status: { not: 'VOID' } },
          _sum: { total: true, paidAmount: true },
          _count: true,
          orderBy: { _sum: { total: 'desc' } },
          take: limit,
        });
        const tenantIds = invoices.map((i) => i.tenantId);
        const tenants = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } });
        const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
        const rows = invoices.map((inv) => ({
          tenantName: tenantMap.get(inv.tenantId) || inv.tenantId,
          invoiceCount: inv._count,
          totalBilled: Number(inv._sum.total || 0),
          totalPaid: Number(inv._sum.paidAmount || 0),
          outstanding: Number(inv._sum.total || 0) - Number(inv._sum.paidAmount || 0),
        }));
        return NextResponse.json({
          title: 'Revenue by Tenant',
          subtitle: `${rows.length} tenant`,
          columns: ['tenantName', 'invoiceCount', 'totalBilled', 'totalPaid', 'outstanding'],
          rows,
          totalLabel: 'Total Revenue',
          totalValue: rows.reduce((s, r) => s + r.totalBilled, 0),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown drill-down type: ${type}` }, { status: 400 });
    }
  });
}
