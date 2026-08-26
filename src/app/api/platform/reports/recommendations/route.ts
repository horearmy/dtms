import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

type Recommendation = {
  id: string;
  category: 'revenue' | 'operations' | 'growth' | 'risk' | 'efficiency';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  impact: string;
  action: string;
  metric?: string;
  tenantId?: string;
  tenantName?: string;
};

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.ANALYTICS.VIEW);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } as Record<string, any> : {} as Record<string, any>;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

    const tenantIds = session?.tenantId ? [session.tenantId] : (await prisma.tenant.findMany({ select: { id: true } })).map((t) => t.id);

    const recs: Recommendation[] = [];
    let idCounter = 0;

    const tenants = await prisma.tenant.findMany({
      where: tenantFilter,
      select: {
        id: true, name: true, plan: true, maxUsers: true, maxShipments: true, maxDrivers: true,
        _count: { select: { users: true, drivers: true, shipments: true } },
      },
    });

    for (const t of tenants) {
      const [currentShipments, prevShipments, overdueInvoices, breaches, exceptions, users] = await Promise.all([
        prisma.shipment.count({ where: { tenantId: t.id, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.shipment.count({ where: { tenantId: t.id, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
        prisma.invoice.findMany({ where: { tenantId: t.id, status: 'OVERDUE' }, select: { total: true, paidAmount: true } }),
        prisma.slaEvent.count({ where: { tenantId: t.id, status: 'BREACHED', createdAt: { gte: thirtyDaysAgo } } }),
        prisma.exception.count({ where: { tenantId: t.id, status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'] as any } } }),
        prisma.user.count({ where: { tenantId: t.id } }),
      ]);

      // Revenue: overdue invoices
      if (overdueInvoices.length > 0) {
        const totalOverdue = overdueInvoices.reduce((s, inv) => s + Number(inv.total) - Number(inv.paidAmount), 0);
        recs.push({
          id: `rec_${++idCounter}`, category: 'revenue', priority: totalOverdue > 5_000_000 ? 'CRITICAL' : 'HIGH',
          title: `Follow-up collection: ${t.name}`,
          description: `${overdueInvoices.length} invoice overdue dengan total outstanding Rp ${(totalOverdue / 1_000_000).toFixed(1)}M`,
          impact: 'Meningkatkan collection rate dan mengurangi risiko churn',
          action: 'Kirim reminder pembayaran dan jadwalkan follow-up dengan tenant',
          metric: `Rp ${(totalOverdue / 1_000_000).toFixed(1)}M overdue`,
          tenantId: t.id,
          tenantName: t.name,
        });
      }

      // Growth: upgrade potential
      const maxShipment = t.maxShipments > 0 ? t.maxShipments : 10000;
      const usagePct = (currentShipments / maxShipment) * 100;
      if (usagePct > 80 && t.plan !== 'ENTERPRISE') {
        recs.push({
          id: `rec_${++idCounter}`, category: 'growth', priority: 'HIGH',
          title: `Upgrade opportunity: ${t.name}`,
          description: `Menggunakan ${usagePct.toFixed(0)}% dari kuota shipment (${currentShipments}/${maxShipment})`,
          impact: 'Potensi peningkatan revenue dan better service level',
          action: 'Tawarkan upgrade plan ke tier yang lebih tinggi',
          metric: `${usagePct.toFixed(0)}% usage`,
          tenantId: t.id,
          tenantName: t.name,
        });
      }

      // Operations: SLA breaches
      if (breaches > 0) {
        recs.push({
          id: `rec_${++idCounter}`, category: 'operations', priority: breaches > 5 ? 'CRITICAL' : 'HIGH',
          title: `Review SLA performance: ${t.name}`,
          description: `${breaches} shipment melanggar SLA dalam 30 hari terakhir`,
          impact: 'Meningkatkan customer satisfaction dan mengurangi churn',
          action: 'Analisis root cause pelanggaran SLA dan implementasi perbaikan',
          metric: `${breaches} breaches`,
          tenantId: t.id,
          tenantName: t.name,
        });
      }

      // Risk: open exceptions
      if (exceptions > 3) {
        recs.push({
          id: `rec_${++idCounter}`, category: 'risk', priority: exceptions > 10 ? 'HIGH' : 'MEDIUM',
          title: `Resolve open exceptions: ${t.name}`,
          description: `${exceptions} exception masih terbuka`,
          impact: 'Mengurangi risiko operasional dan meningkatkan kualitas layanan',
          action: 'Alokasi resource untuk menyelesaikan exception yang sudah menumpuk',
          metric: `${exceptions} open`,
          tenantId: t.id,
          tenantName: t.name,
        });
      }

      // Churn risk
      if (prevShipments > 0) {
        const drop = ((prevShipments - currentShipments) / prevShipments) * 100;
        if (drop > 25) {
          recs.push({
            id: `rec_${++idCounter}`, category: 'risk', priority: drop > 50 ? 'CRITICAL' : 'HIGH',
            title: `Churn risk: ${t.name}`,
            description: `Volume shipment turun ${drop.toFixed(0)}% (${prevShipments} → ${currentShipments})`,
            impact: 'Risiko kehilangan tenant',
            action: 'Hubungi tenant untuk memahami penurunan dan tawarkan dukungan',
          metric: `-${drop.toFixed(0)}%`,
          tenantId: t.id,
          tenantName: t.name,
          });
        }
      }

      // Efficiency: unused seats
      if (t.maxUsers > 0 && users < t.maxUsers * 0.3 && t.plan !== 'FREE') {
        recs.push({
          id: `rec_${++idCounter}`, category: 'efficiency', priority: 'LOW',
          title: `Low user adoption: ${t.name}`,
          description: `Hanya ${users} dari ${t.maxUsers} user seat terpakai (${Math.round((users / t.maxUsers) * 100)}%)`,
          impact: 'Mengoptimalkan biaya dan meningkatkan value per user',
          action: 'Edukasi tenant tentang fitur platform dan ajak untuk mengundang lebih banyak user',
          metric: `${users}/${t.maxUsers} users`,
          tenantId: t.id,
          tenantName: t.name,
        });
      }
    }

    // Platform-wide recommendations
    const totalTenants = tenants.length;
    if (totalTenants > 0) {
      const totalShipments30d = await prisma.shipment.count({ where: { ...tenantFilter, createdAt: { gte: thirtyDaysAgo } } });
      const totalShipmentsPrev = await prisma.shipment.count({ where: { ...tenantFilter, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } });
      if (totalShipmentsPrev > 0) {
        const growthPct = ((totalShipments30d - totalShipmentsPrev) / totalShipmentsPrev) * 100;
        if (growthPct > 20) {
          recs.push({
            id: `rec_${++idCounter}`, category: 'growth', priority: 'MEDIUM',
            title: 'Platform growth surge',
            description: `Shipment volume naik ${growthPct.toFixed(0)}% month-over-month`,
            impact: 'Pastikan infrastruktur dan support siap mengakomodasi pertumbuhan',
            action: 'Monitor capacity, perkuat tim support, dan review SLA infrastructure',
            metric: `+${growthPct.toFixed(0)}% growth`,
          });
        }
      }
    }

    recs.sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    });

    const summary = {
      total: recs.length,
      critical: recs.filter((r) => r.priority === 'CRITICAL').length,
      high: recs.filter((r) => r.priority === 'HIGH').length,
      medium: recs.filter((r) => r.priority === 'MEDIUM').length,
      low: recs.filter((r) => r.priority === 'LOW').length,
      byCategory: {
        revenue: recs.filter((r) => r.category === 'revenue').length,
        operations: recs.filter((r) => r.category === 'operations').length,
        growth: recs.filter((r) => r.category === 'growth').length,
        risk: recs.filter((r) => r.category === 'risk').length,
        efficiency: recs.filter((r) => r.category === 'efficiency').length,
      },
    };

    return NextResponse.json({ recommendations: recs, summary });
  });
}
