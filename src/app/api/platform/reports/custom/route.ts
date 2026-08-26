import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type Dataset = 'shipments' | 'tenants' | 'customers' | 'drivers' | 'vehicles' | 'exceptions' | 'invoices' | 'integration_logs';

type ReportConfig = {
  dataset: Dataset;
  dimension: string;
  metric: string;
  filters?: Record<string, string>;
  limit?: number;
};

const DATASET_FIELDS: Record<Dataset, { table: string; fields: string[]; dateField: string }> = {
  shipments:    { table: 'Shipment',   fields: ['status', 'serviceType', 'origin', 'destination', 'tenantId'], dateField: 'createdAt' },
  tenants:      { table: 'Tenant',     fields: ['status', 'plan', 'active'], dateField: 'createdAt' },
  customers:    { table: 'Customer',   fields: ['city', 'province', 'tenantId'], dateField: 'createdAt' },
  drivers:      { table: 'Driver',     fields: ['status', 'tenantId'], dateField: 'createdAt' },
  vehicles:     { table: 'Vehicle',    fields: ['vehicleType', 'status', 'tenantId'], dateField: 'createdAt' },
  exceptions:   { table: 'Exception',  fields: ['type', 'severity', 'status', 'tenantId'], dateField: 'createdAt' },
  invoices:     { table: 'Invoice',    fields: ['status', 'tenantId'], dateField: 'createdAt' },
  integration_logs: { table: 'IntegrationLog', fields: ['direction', 'statusGroup', 'integrationType', 'tenantId'], dateField: 'createdAt' },
};

const METRICS: Record<string, (dataset: Dataset) => string> = {
  count: () => 'COUNT(*)::int AS value',
  total_billed: () => 'COALESCE(SUM("total"), 0)::float AS value',
  total_paid: () => 'COALESCE(SUM("paidAmount"), 0)::float AS value',
  avg_odometer: () => 'COALESCE(AVG("odometerKm"), 0)::float AS value',
  total_cost: () => 'COALESCE(SUM("cost"), 0)::float AS value',
};

function getPeriodClause(preset: string): { clause: string; params: any[] } {
  switch (preset) {
    case 'today':
      return { clause: `AND ${getTableDateField(preset)} >= CURRENT_DATE`, params: [] };
    case 'last_7_days':
      return { clause: `AND ${getTableDateField(preset)} >= NOW() - INTERVAL '7 days'`, params: [] };
    case 'last_30_days':
      return { clause: `AND ${getTableDateField(preset)} >= NOW() - INTERVAL '30 days'`, params: [] };
    case 'last_month':
      return { clause: `AND ${getTableDateField(preset)} >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND ${getTableDateField(preset)} < DATE_TRUNC('month', NOW())`, params: [] };
    case 'this_quarter':
      return { clause: `AND ${getTableDateField(preset)} >= DATE_TRUNC('quarter', NOW())`, params: [] };
    case 'this_year':
      return { clause: `AND ${getTableDateField(preset)} >= DATE_TRUNC('year', NOW())`, params: [] };
    default:
      return { clause: `AND ${getTableDateField(preset)} >= DATE_TRUNC('month', NOW())`, params: [] };
  }
}

function getTableDateField(_preset: string): string {
  return '"createdAt"';
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  const dataset = (req.nextUrl.searchParams.get('dataset') || 'shipments') as Dataset;
  const dimension = req.nextUrl.searchParams.get('dimension') || 'status';
  const metric = req.nextUrl.searchParams.get('metric') || 'count';
  const preset = req.nextUrl.searchParams.get('preset') || 'this_month';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 50);

  const dsInfo = DATASET_FIELDS[dataset];
  if (!dsInfo) return NextResponse.json({ error: 'Invalid dataset' }, { status: 400 });
  if (!dsInfo.fields.includes(dimension)) return NextResponse.json({ error: `Invalid dimension "${dimension}" for ${dataset}` }, { status: 400 });

  const metricExpr = METRICS[metric]?.(dataset);
  if (!metricExpr) return NextResponse.json({ error: `Invalid metric "${metric}"` }, { status: 400 });

  const tenantFilter = session?.tenantId ? `AND "tenantId" = '${session.tenantId}'` : '';
  const period = getPeriodClause(preset);

  const sql = `
    SELECT "${dimension}" AS dimension, ${metricExpr}
    FROM "${dsInfo.table}"
    WHERE TRUE
      ${tenantFilter}
      ${period.clause}
    GROUP BY "${dimension}"
    ORDER BY value DESC
    LIMIT ${limit}
  `;

  const rows: any[] = await prisma.$queryRawUnsafe(sql);

  return NextResponse.json({
    dataset,
    dimension,
    metric,
    preset,
    data: rows.map((r) => ({
      label: r.dimension || 'Unknown',
      value: typeof r.value === 'bigint' ? Number(r.value) : r.value,
    })),
  });
}
