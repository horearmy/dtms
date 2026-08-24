import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET — ringkasan billing semua plan (superadmin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const [plans, activeSubs, totalTenants] = await Promise.all([
    prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { planId: true, billingCycle: true },
    }),
    prisma.tenant.count(),
  ]);

  type Agg = { count: number; mrr: number };
  const agg = new Map<string, Agg>();
  let totalMrr = 0;

  for (const s of activeSubs) {
    const plan = plans.find((p) => p.id === s.planId);
    if (!plan) continue;
    const entry = agg.get(plan.id) || { count: 0, mrr: 0 };
    entry.count += 1;
    entry.mrr += s.billingCycle === 'YEARLY' ? plan.priceYearly / 12 : plan.priceMonthly;
    agg.set(plan.id, entry);
    totalMrr += s.billingCycle === 'YEARLY' ? plan.priceYearly / 12 : plan.priceMonthly;
  }

  const result = plans.map((p) => {
    const a = agg.get(p.id) || { count: 0, mrr: 0 };
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      currency: p.currency,
      trialDays: p.trialDays,
      maxUsers: p.maxUsers,
      maxDrivers: p.maxDrivers,
      maxShipments: p.maxShipments,
      maxStorageMb: p.maxStorageMb,
      maxBranches: p.maxBranches,
      maxHubs: p.maxHubs,
      subscribers: a.count,
      mrr: Math.round(a.mrr),
    };
  });

  // Tenant tanpa record subscription dihitung sebagai FREE
  const freePlan = plans.find((p) => p.code === 'FREE');
  const orphanFree = freePlan ? Math.max(0, totalTenants - activeSubs.length) : 0;

  return NextResponse.json({
    plans: result.map((p) =>
      freePlan && p.id === freePlan.id ? { ...p, subscribers: p.subscribers + orphanFree } : p
    ),
    summary: {
      totalTenants,
      activeSubscriptions: activeSubs.length,
      estimatedMrr: Math.round(totalMrr),
      currency: 'IDR',
    },
  });
}
