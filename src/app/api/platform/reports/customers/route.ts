import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { Prisma } from '@prisma/client';

type Period = { from: Date; to: Date };

function parsePeriod(sp: URLSearchParams): Period {
  const preset = sp.get('preset') || 'this_month';
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case 'today': return { from: sod, to: now };
    case 'last_7_days': { const f = new Date(sod); f.setDate(f.getDate() - 6); return { from: f, to: now }; }
    case 'last_30_days': { const f = new Date(sod); f.setDate(f.getDate() - 29); return { from: f, to: now }; }
    case 'last_month': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
    case 'this_quarter': { const q = Math.floor(now.getMonth() / 3); return { from: new Date(now.getFullYear(), q * 3, 1), to: now }; }
    case 'this_year': return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case 'custom': {
      const from = new Date(sp.get('from') || sod);
      const to = new Date(sp.get('to') || now);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('Invalid date');
      }
      return { from, to };
    }
    case 'this_month': default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    let period: Period;
    try { period = parsePeriod(req.nextUrl.searchParams); } catch { return NextResponse.json({ error: 'Invalid date parameters' }, { status: 400 }); }
    const tf: Prisma.CustomerWhereInput = session?.tenantId ? { tenantId: session.tenantId } : {};

    const [
      totalCustomers,
      newThisPeriod,
      prevNewPeriod,
      customersByCity,
      topSenders,
      topReceivers,
      activeCustomerIds,
      dormantCustomers,
      customerGrowthTrend,
    ] = await Promise.all([
      prisma.customer.count({ where: tf }),
      prisma.customer.count({ where: { ...tf, createdAt: { gte: period.from, lte: period.to } } }),
      prisma.customer.count({
        where: {
          ...tf,
          createdAt: {
            gte: new Date(period.from.getTime() - (period.to.getTime() - period.from.getTime())),
            lt: period.from,
          },
        },
      }),
      prisma.customer.groupBy({
        by: ['city'],
        where: { ...tf, city: { not: null } },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 15,
      }),
      prisma.$queryRaw<{ customerId: string; name: string; count: bigint; totalWeight: number }[]>`
        SELECT s."senderId" as "customerId", c.name, COUNT(*) as count, SUM(s.weight) as "totalWeight"
        FROM "Shipment" s
        JOIN "Customer" c ON c.id = s."senderId"
        WHERE s."createdAt" >= ${period.from} AND s."createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND s."tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY s."senderId", c.name
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.$queryRaw<{ customerId: string; name: string; count: bigint; totalWeight: number }[]>`
        SELECT s."receiverId" as "customerId", c.name, COUNT(*) as count, SUM(s.weight) as "totalWeight"
        FROM "Shipment" s
        JOIN "Customer" c ON c.id = s."receiverId"
        WHERE s."createdAt" >= ${period.from} AND s."createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND s."tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY s."receiverId", c.name
        ORDER BY count DESC
        LIMIT 10
      `,
      prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT c.id
        FROM "Customer" c
        INNER JOIN "Shipment" s ON s."senderId" = c.id OR s."receiverId" = c.id
        WHERE s."createdAt" >= ${period.from} AND s."createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND c."tenantId" = ${session.tenantId}` : Prisma.sql``}
      `,
      prisma.customer.findMany({
        where: {
          ...tf,
          sentShipments: { none: {} },
          receivedShipments: { none: {} },
        },
        select: { id: true, name: true, createdAt: true },
        take: 50,
      }),
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('month', c."createdAt") as month, COUNT(*) as count
        FROM "Customer" c
        WHERE c."createdAt" >= ${new Date(period.from.getFullYear() - 1, period.from.getMonth(), 1)} AND c."createdAt" <= ${period.to}
          ${session?.tenantId ? Prisma.sql`AND c."tenantId" = ${session.tenantId}` : Prisma.sql``}
        GROUP BY DATE_TRUNC('month', c."createdAt")
        ORDER BY month ASC
      `,
    ]);

    const activeCustomerCount = activeCustomerIds.length;
    const dormantCount = dormantCustomers.length;
    const activityRate = totalCustomers > 0 ? (activeCustomerCount / totalCustomers) * 100 : 0;

    const growthPct = prevNewPeriod > 0 ? ((newThisPeriod - prevNewPeriod) / prevNewPeriod) * 100 : 0;

    const insights: Array<{ type: string; text: string }> = [];

    if (growthPct > 0) {
      insights.push({ type: 'positive', text: `Customer baru meningkat ${growthPct.toFixed(1)}% (${prevNewPeriod} → ${newThisPeriod}).` });
    }
    if (activityRate < 50) {
      insights.push({ type: 'attention', text: `Hanya ${activityRate.toFixed(0)}% customer aktif (${activeCustomerCount}/${totalCustomers}). ${dormantCount} customer dormant.` });
    }
    if (dormantCount > 0) {
      insights.push({ type: 'attention', text: `${dormantCount} customer belum memiliki shipment. Perlu re-engagement campaign.` });
    }
    if (topSenders.length > 0) {
      insights.push({ type: 'info', text: `Top sender: ${topSenders[0].name} (${topSenders[0].count} shipments). Top receiver: ${topReceivers[0]?.name || '-'} (${topReceivers[0]?.count || 0} shipments).` });
    }

    return NextResponse.json({
      period: { from: period.from.toISOString(), to: period.to.toISOString() },
      summary: {
        total: totalCustomers,
        newThisPeriod,
        active: activeCustomerCount,
        dormant: dormantCount,
        activityRate: Number(activityRate.toFixed(1)),
        growthPct: Number(growthPct.toFixed(1)),
      },
      byCity: customersByCity.map((c) => ({ city: c.city || 'Lainnya', count: c._count })),
      topSenders: topSenders.map((s) => ({ customerId: s.customerId, name: s.name, shipmentCount: Number(s.count), totalWeight: Number(s.totalWeight || 0) })),
      topReceivers: topReceivers.map((r) => ({ customerId: r.customerId, name: r.name, shipmentCount: Number(r.count), totalWeight: Number(r.totalWeight || 0) })),
      dormant: dormantCustomers.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt.toISOString() })),
      trend: customerGrowthTrend.map((t) => ({ month: t.month.toISOString().split('T')[0], count: Number(t.count) })),
      insights,
    });
  });
}
