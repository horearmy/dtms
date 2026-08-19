// src/lib/billing.ts
// Subscription & billing service.
import { prisma } from './prisma';
import { logger } from './logger';

const log = logger.child('billing');

let plansSeeded = false;

async function ensurePlans() {
  if (plansSeeded) return;
  await seedPlans();
  plansSeeded = true;
}

// ─── Plan Management ─────────────────────────────────────
export async function getPlans() {
  await ensurePlans();
  return prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTenantSubscription(tenantId: string) {
  await ensurePlans();
  return prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
}

// ─── Feature & Limit Enforcement ─────────────────────────
export async function getTenantFeatures(tenantId: string): Promise<string[]> {
  await ensurePlans();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  const planCode = tenant?.plan || 'FREE';
  const plan = await prisma.plan.findUnique({ where: { code: planCode }, select: { features: true } });
  if (!plan?.features) return ['basic_tracking'];
  try {
    return Array.isArray(plan.features) ? plan.features as string[] : JSON.parse(plan.features as string);
  } catch {
    return ['basic_tracking'];
  }
}

type ResourceKey = 'users' | 'drivers' | 'shipments';

const RESOURCE_COUNT_FN: Record<ResourceKey, (tenantId: string) => Promise<number>> = {
  users: (tid) => prisma.user.count({ where: { tenantId: tid } }),
  drivers: (tid) => prisma.driver.count({ where: { tenantId: tid } }),
  shipments: (tid) => prisma.shipment.count({ where: { tenantId: tid } }),
};

const RESOURCE_LIMIT_FIELD: Record<ResourceKey, string> = {
  users: 'maxUsers',
  drivers: 'maxDrivers',
  shipments: 'maxShipments',
};

export async function checkPlanLimit(
  tenantId: string,
  resource: ResourceKey
): Promise<{ allowed: boolean; current: number; max: number }> {
  await ensurePlans();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, maxUsers: true, maxDrivers: true, maxShipments: true },
  });
  if (!tenant) return { allowed: false, current: 0, max: 0 };

  const max = tenant[RESOURCE_LIMIT_FIELD[resource] as keyof typeof tenant] as number;
  const current = await RESOURCE_COUNT_FN[resource](tenantId);

  // -1 means unlimited
  if (max < 0) return { allowed: true, current, max: -1 };
  return { allowed: current < max, current, max };
}

// ─── Subscription Lifecycle ───────────────────────────────
export async function createSubscription(tenantId: string, planCode: string, billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
  await ensurePlans();
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new Error(`Plan ${planCode} not found`);

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'MONTHLY') periodEnd.setMonth(periodEnd.getMonth() + 1);
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelledAt: null,
    },
    create: {
      tenantId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    include: { plan: true },
  });

  // Update tenant plan
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan: plan.code,
      maxUsers: plan.maxUsers,
      maxDrivers: plan.maxDrivers,
      maxShipments: plan.maxShipments,
    },
  });

  // Auto-generate invoice for paid plans
  if (plan.priceMonthly > 0) {
    try {
      await generateInvoice(tenantId);
    } catch (e) {
      log.warn('Failed to auto-generate invoice', { tenantId, error: e });
    }
  }

  log.info('Subscription created/updated', { tenantId, plan: plan.code, cycle: billingCycle });
  return subscription;
}

export async function cancelSubscription(tenantId: string) {
  await ensurePlans();
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw new Error('No subscription found');

  // Downgrade to FREE
  const freePlan = await prisma.plan.findUnique({ where: { code: 'FREE' } });
  if (freePlan) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: 'FREE',
        maxUsers: freePlan.maxUsers,
        maxDrivers: freePlan.maxDrivers,
        maxShipments: freePlan.maxShipments,
      },
    });

    // Set subscription to FREE plan
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        planId: freePlan.id,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  } else {
    await prisma.subscription.update({
      where: { tenantId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  log.info('Subscription cancelled & downgraded to FREE', { tenantId });
}

// ─── Usage Tracking ──────────────────────────────────────
export async function recordUsage(tenantId: string, metric: string, quantity: number) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) return;

  await prisma.usageRecord.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      metric,
      quantity,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
    },
  });
}

export async function getUsageSummary(tenantId: string) {
  await ensurePlans();
  const sub = await prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
  if (!sub) return null;

  const records = await prisma.usageRecord.findMany({
    where: {
      tenantId,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
    },
  });

  const usage: Record<string, number> = {};
  for (const r of records) {
    usage[r.metric] = (usage[r.metric] || 0) + r.quantity;
  }

  // Current counts
  const [users, drivers, shipments] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.driver.count({ where: { tenantId } }),
    prisma.shipment.count({ where: { tenantId } }),
  ]);

  return {
    plan: sub.plan,
    subscription: sub,
    usage: { ...usage, users, drivers, shipments },
    limits: {
      maxUsers: sub.plan.maxUsers,
      maxDrivers: sub.plan.maxDrivers,
      maxShipments: sub.plan.maxShipments,
    },
  };
}

// ─── Invoice Generation ──────────────────────────────────
export async function generateInvoice(tenantId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  if (!sub || !sub.plan) throw new Error('No active subscription');

  // Skip if plan is free
  const amount = sub.billingCycle === 'MONTHLY' ? sub.plan.priceMonthly : sub.plan.priceYearly;
  if (amount <= 0) throw new Error('Free plan does not generate invoices');

  const now = new Date();
  const count = await prisma.invoice.count({ where: { tenantId } });
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

  const tax = Math.round(amount * 0.11); // PPN 11%

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      subscriptionId: sub.id,
      invoiceNumber,
      subtotal: amount,
      tax,
      total: amount + tax,
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
      billingPeriodStart: sub.currentPeriodStart,
      billingPeriodEnd: sub.currentPeriodEnd,
      lineItems: JSON.stringify([
        { description: `${sub.plan.name} (${sub.billingCycle === 'MONTHLY' ? 'Bulanan' : 'Tahunan'})`, amount, quantity: 1 },
      ]),
    },
  });

  log.info('Invoice generated', { tenantId, invoiceNumber, total: invoice.total });
  return invoice;
}

// ─── Seed Plans ──────────────────────────────────────────
async function seedPlans() {
  const plans = [
    { code: 'FREE', name: 'Free', priceMonthly: 0, priceYearly: 0, maxUsers: 3, maxDrivers: 5, maxShipments: 50, maxStorageMb: 100, sortOrder: 0, features: JSON.stringify(['basic_tracking']) },
    { code: 'STARTER', name: 'Starter', priceMonthly: 299000, priceYearly: 2990000, maxUsers: 5, maxDrivers: 15, maxShipments: 200, maxStorageMb: 500, sortOrder: 1, features: JSON.stringify(['basic_tracking', 'dispatch', 'reports']) },
    { code: 'PRO', name: 'Professional', priceMonthly: 799000, priceYearly: 7990000, maxUsers: 15, maxDrivers: 50, maxShipments: 1000, maxStorageMb: 2048, sortOrder: 2, features: JSON.stringify(['basic_tracking', 'dispatch', 'reports', 'sla', 'eta', 'control_tower', 'api']) },
    { code: 'ENTERPRISE', name: 'Enterprise', priceMonthly: 1999000, priceYearly: 19990000, maxUsers: -1, maxDrivers: -1, maxShipments: -1, maxStorageMb: 10240, sortOrder: 3, features: JSON.stringify(['basic_tracking', 'dispatch', 'reports', 'sla', 'eta', 'control_tower', 'api', 'webhooks', 'integrations', 'priority_support']) },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  log.info('Plans seeded', { count: plans.length });
}

// ─── Route → Feature Mapping ─────────────────────────────
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/control-tower': 'control_tower',
  '/dispatch': 'dispatch',
  '/reports': 'reports',
  '/analytics': 'reports',
  '/sla': 'sla',
  '/exceptions': 'sla',
  '/integrations': 'integrations',
};
