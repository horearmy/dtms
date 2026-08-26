import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type ExportType = 'shipments' | 'tenants' | 'drivers' | 'vehicles' | 'customers' | 'exceptions' | 'invoices' | 'integration_logs';

function toCSV(headers: string[], rows: any[][]): string {
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.REPORT.EXPORT);
  if (error) return error;

  const type = req.nextUrl.searchParams.get('type') as ExportType | null;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '500', 10) || 500, 5000);

  if (!type) return NextResponse.json({ error: 'Missing type' }, { status: 400 });

  return runWithTenant(session?.tenantId ?? null, async () => {
    const where = session?.tenantId ? { tenantId: session.tenantId } as Record<string, any> : {} as Record<string, any>;

    let response: NextResponse;
    try {
      switch (type) {
        case 'shipments': {
          const rows = await prisma.shipment.findMany({
            where,
            select: {
              trackingNumber: true, status: true, serviceType: true, origin: true, destination: true,
              createdAt: true,
              sender: { select: { name: true } },
              assignments: { select: { driver: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });
          const headers = ['Tracking No', 'Status', 'Service Type', 'Sender', 'Origin', 'Destination', 'Driver', 'Created At'];
          const data = rows.map((r) => [
            r.trackingNumber, r.status, r.serviceType, r.sender?.name || '-',
            r.origin, r.destination, r.assignments?.[0]?.driver?.name || '-',
            r.createdAt.toISOString(),
          ]);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="shipments_export.csv"' },
          });
          break;
        }
        case 'tenants': {
          const rows = await prisma.tenant.findMany({
            where,
            select: { name: true, status: true, slug: true, active: true, createdAt: true },
            orderBy: { createdAt: 'desc' }, take: limit,
          });
          const headers = ['Name', 'Status', 'Slug', 'Active', 'Created At'];
          const data = rows.map((r) => [r.name, r.status, r.slug || '-', r.active ? 'Yes' : 'No', r.createdAt.toISOString()]);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="tenants_export.csv"' },
          });
          break;
        }
        case 'drivers': {
          const rows = await prisma.driver.findMany({
            where,
            select: { name: true, phone: true, employeeId: true, status: true, tenantId: true },
            take: limit,
          });
          const headers = ['Name', 'Phone', 'Employee ID', 'Status', 'Tenant ID'];
          const data = rows.map((r) => [r.name, r.phone, r.employeeId, r.status, r.tenantId || '-']);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="drivers_export.csv"' },
          });
          break;
        }
        case 'vehicles': {
          const rows = await prisma.vehicle.findMany({
            where,
            select: { vehicleNumber: true, type: true, capacity: true, status: true, totalDistanceKm: true, tenantId: true },
            orderBy: { vehicleNumber: 'asc' }, take: limit,
          });
          const headers = ['Vehicle Number', 'Type', 'Capacity', 'Status', 'Distance (km)', 'Tenant ID'];
          const data = rows.map((r) => [r.vehicleNumber, r.type, r.capacity, r.status, r.totalDistanceKm, r.tenantId || '-']);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="vehicles_export.csv"' },
          });
          break;
        }
        case 'customers': {
          const rows = await prisma.customer.findMany({
            where,
            select: { name: true, email: true, phone: true, city: true, address: true, createdAt: true },
            orderBy: { createdAt: 'desc' }, take: limit,
          });
          const headers = ['Name', 'Email', 'Phone', 'City', 'Address', 'Created At'];
          const data = rows.map((r) => [r.name, r.email || '-', r.phone, r.city || '-', r.address || '-', r.createdAt.toISOString()]);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="customers_export.csv"' },
          });
          break;
        }
        case 'exceptions': {
          const rows = await prisma.exception.findMany({
            where,
            select: { title: true, type: true, severity: true, status: true, createdAt: true, dueAt: true, tenant: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }, take: limit,
          });
          const headers = ['Title', 'Type', 'Severity', 'Status', 'Tenant', 'Created At', 'Due At'];
          const data = rows.map((r) => [r.title, r.type, r.severity, r.status, r.tenant?.name || '-', r.createdAt.toISOString(), r.dueAt?.toISOString() || '-']);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="exceptions_export.csv"' },
          });
          break;
        }
        case 'invoices': {
          const rows = await prisma.invoice.findMany({
            where,
            select: { invoiceNumber: true, status: true, total: true, paidAmount: true, dueDate: true, createdAt: true, tenant: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }, take: limit,
          });
          const headers = ['Invoice No', 'Tenant', 'Status', 'Total', 'Paid', 'Due Date', 'Created At'];
          const data = rows.map((r) => [r.invoiceNumber, r.tenant?.name || '-', r.status, r.total, r.paidAmount, r.dueDate?.toISOString() || '-', r.createdAt.toISOString()]);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="invoices_export.csv"' },
          });
          break;
        }
        case 'integration_logs': {
          const logs = await prisma.integrationLog.findMany({
            where: where.tenantId ? { integrationConfig: { tenantId: where.tenantId } } : {},
            select: {
              direction: true, statusCode: true, error: true, durationMs: true, createdAt: true, method: true, path: true,
              integrationConfig: { select: { name: true, type: true, tenant: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'desc' }, take: limit,
          });
          const headers = ['Direction', 'Method', 'Path', 'Status Code', 'Integration', 'Tenant', 'Error', 'Duration (ms)', 'Created At'];
          const data = logs.map((r) => [
            r.direction, r.method || '-', r.path || '-', r.statusCode || '-', r.integrationConfig?.name || '-',
            r.integrationConfig?.tenant?.name || '-', r.error || '-', r.durationMs || '-', r.createdAt.toISOString(),
          ]);
          response = new NextResponse(toCSV(headers, data), {
            headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="integration_logs_export.csv"' },
          });
          break;
        }
        default:
          response = NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
      }
    } finally {
      logAudit(session, 'EXPORT_DATA', 'report_export', { newData: type }, req);
    }
    return response;
  });
}
