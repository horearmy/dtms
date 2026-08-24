import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  if (session.role !== 'SUPER_ADMIN' && session.tenantId !== id) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, status: true, active: true } });
  if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });

  const [userCount, driverCount, shipmentCount, vehicleCount, customerCount, recentMetrics] = await Promise.all([
    prisma.user.count({ where: { tenantId: id } }),
    prisma.driver.count({ where: { tenantId: id } }),
    prisma.shipment.count({ where: { tenantId: id } }),
    prisma.vehicle.count({ where: { tenantId: id } }),
    prisma.customer.count({ where: { tenantId: id } }),
    prisma.tenantHealthMetric.findMany({
      where: { tenantId: id },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    }),
  ]);

  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [shipments30d, shipments7d, exceptions] = await Promise.all([
    prisma.shipment.count({ where: { tenantId: id, createdAt: { gte: last30d } } }),
    prisma.shipment.count({ where: { tenantId: id, createdAt: { gte: last7d } } }),
    prisma.exception.count({ where: { tenantId: id, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } } }),
  ]);

  const metricsByType: Record<string, { latest: number; avg: number; trend: number }> = {};
  const metricTypes = [...new Set(recentMetrics.map(m => m.metricType))];
  for (const mt of metricTypes) {
    const vals = recentMetrics.filter(m => m.metricType === mt);
    const latest = vals[0]?.value || 0;
    const avg = vals.reduce((s, v) => s + v.value, 0) / (vals.length || 1);
    const recent7 = vals.filter(v => v.recordedAt >= last7d);
    const older = vals.filter(v => v.recordedAt < last7d);
    const recentAvg7 = recent7.length ? recent7.reduce((s, v) => s + v.value, 0) / recent7.length : avg;
    const olderAvg = older.length ? older.reduce((s, v) => s + v.value, 0) / older.length : avg;
    const trend = olderAvg > 0 ? ((recentAvg7 - olderAvg) / olderAvg) * 100 : 0;
    metricsByType[mt] = { latest, avg: Math.round(avg * 100) / 100, trend: Math.round(trend * 100) / 100 };
  }

  const healthScore = tenant.status === 'ACTIVE' && tenant.active
    ? Math.min(100, Math.round(
        (exceptions === 0 ? 40 : Math.max(0, 40 - exceptions * 5))
        + (shipmentCount > 0 ? 30 : 10)
        + (userCount > 0 ? 15 : 0)
        + (driverCount > 0 ? 15 : 0)
      ))
    : 0;

  return NextResponse.json({
    tenant,
    healthScore,
    usage: { users: userCount, drivers: driverCount, shipments: shipmentCount, vehicles: vehicleCount, customers: customerCount },
    activity: { shipments30d, shipments7d, openExceptions: exceptions },
    metrics: metricsByType,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { metricType, value, unit, period } = body;

  if (!metricType || value === undefined) {
    return NextResponse.json({ error: 'metricType dan value wajib' }, { status: 400 });
  }

  const metric = await prisma.tenantHealthMetric.create({
    data: {
      tenantId: id,
      metricType: String(metricType).slice(0, 50),
      value: Number(value),
      unit: unit ? String(unit).slice(0, 20) : null,
      period: period ? String(period).slice(0, 20) : null,
    },
  });

  return NextResponse.json(metric, { status: 201 });
}
