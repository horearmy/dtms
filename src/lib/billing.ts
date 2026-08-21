// src/lib/billing.ts
// Subscription & billing service — SINGLE SOURCE OF TRUTH for plan data.
// Plans are seeded ONLY from prisma/seed.js (or ensurePlans fallback).
import { prisma } from './prisma';
import { logger } from './logger';

const log = logger.child('billing');

// ─── 5-Tier Plan Definitions (canonical, matches seed.js) ─
const PLAN_DEFINITIONS = [
  {
    code: 'FREE', name: 'Free', description: 'Coba gratis selamanya',
    priceMonthly: 0, priceYearly: 0, sortOrder: 0, trialDays: 0,
    maxUsers: 3, maxDrivers: 5, maxShipments: 50, maxStorageMb: 50,
    maxBranches: 1, maxHubs: 0, maxOrganizations: 1, maxApiCallsPerMin: 0,
    features: ['basic_tracking', 'dispatch'],
  },
  {
    code: 'STARTER', name: 'Starter', description: 'Untuk bisnis kecil',
    priceMonthly: 199000, priceYearly: 1990000, sortOrder: 1, trialDays: 14,
    maxUsers: 5, maxDrivers: 15, maxShipments: 500, maxStorageMb: 500,
    maxBranches: 2, maxHubs: 2, maxOrganizations: 1, maxApiCallsPerMin: 60,
    features: ['basic_tracking', 'dispatch', 'reports', 'gps_tracking'],
  },
  {
    code: 'GROWTH', name: 'Growth', description: 'Untuk logistik menengah',
    priceMonthly: 449000, priceYearly: 4290000, sortOrder: 2, trialDays: 14,
    maxUsers: 15, maxDrivers: 40, maxShipments: 2000, maxStorageMb: 2048,
    maxBranches: 10, maxHubs: 10, maxOrganizations: 3, maxApiCallsPerMin: 120,
    features: ['basic_tracking', 'dispatch', 'reports', 'gps_tracking', 'warehouse_management', 'geofencing', 'branch_management'],
  },
  {
    code: 'PRO', name: 'Professional', description: 'Untuk tim operasional',
    priceMonthly: 899000, priceYearly: 8630000, sortOrder: 3, trialDays: 30,
    maxUsers: 50, maxDrivers: 150, maxShipments: 10000, maxStorageMb: 5120,
    maxBranches: -1, maxHubs: -1, maxOrganizations: -1, maxApiCallsPerMin: 600,
    features: ['basic_tracking', 'dispatch', 'reports', 'gps_tracking', 'warehouse_management', 'geofencing', 'branch_management', 'sla', 'eta', 'control_tower', 'api', 'webhooks', 'daily_reports'],
  },
  {
    code: 'ENTERPRISE', name: 'Enterprise', description: 'Untuk perusahaan besar',
    priceMonthly: 2499000, priceYearly: 24490000, sortOrder: 4, trialDays: 30,
    maxUsers: -1, maxDrivers: -1, maxShipments: -1, maxStorageMb: 20480,
    maxBranches: -1, maxHubs: -1, maxOrganizations: -1, maxApiCallsPerMin: -1,
    features: ['basic_tracking', 'dispatch', 'reports', 'gps_tracking', 'warehouse_management', 'geofencing', 'branch_management', 'sla', 'eta', 'control_tower', 'api', 'webhooks', 'daily_reports', 'analytics_advanced', 'integrations', 'whatsapp_integration', 'white_label', 'priority_support'],
  },
];

const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];

let plansSeeded = false;

async function ensurePlans() {
  if (plansSeeded) return;
  const count = await prisma.plan.count();
  if (count === 0) {
    for (const p of PLAN_DEFINITIONS) {
      await prisma.plan.upsert({
        where: { code: p.code },
        update: p,
        create: p,
      });
    }
    log.info('Plans auto-seeded (fallback)', { count: PLAN_DEFINITIONS.length });
  }
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

export async function getPlanByCode(code: string) {
  await ensurePlans();
  return prisma.plan.findUnique({ where: { code } });
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
  if (!plan?.features) return ['basic_tracking', 'dispatch'];
  try {
    return Array.isArray(plan.features) ? plan.features as string[] : JSON.parse(plan.features as string);
  } catch {
    return ['basic_tracking', 'dispatch'];
  }
}

type ResourceKey = 'users' | 'drivers' | 'shipments' | 'branches' | 'hubs' | 'organizations';

const RESOURCE_COUNT_FN: Record<ResourceKey, (tenantId: string) => Promise<number>> = {
  users: (tid) => prisma.user.count({ where: { tenantId: tid } }),
  drivers: (tid) => prisma.driver.count({ where: { tenantId: tid } }),
  shipments: (tid) => prisma.shipment.count({ where: { tenantId: tid } }),
  branches: (tid) => prisma.branch.count({ where: { tenantId: tid } }),
  hubs: (tid) => prisma.hub.count({ where: { tenantId: tid } }),
  organizations: (tid) => prisma.organization.count({ where: { tenantId: tid } }),
};

const RESOURCE_LIMIT_FIELD: Record<ResourceKey, string> = {
  users: 'maxUsers',
  drivers: 'maxDrivers',
  shipments: 'maxShipments',
  branches: 'maxBranches',
  hubs: 'maxHubs',
  organizations: 'maxOrganizations',
};

export async function checkPlanLimit(
  tenantId: string,
  resource: ResourceKey
): Promise<{ allowed: boolean; current: number; max: number }> {
  await ensurePlans();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      plan: true,
      maxUsers: true,
      maxDrivers: true,
      maxShipments: true,
      maxBranches: true,
      maxHubs: true,
      maxOrganizations: true,
    },
  });
  if (!tenant) return { allowed: false, current: 0, max: 0 };

  const max = tenant[RESOURCE_LIMIT_FIELD[resource] as keyof typeof tenant] as number;
  const current = await RESOURCE_COUNT_FN[resource](tenantId);

  // -1 means unlimited
  if (max < 0) return { allowed: true, current, max: -1 };
  return { allowed: current < max, current, max };
}

// ─── Addon Support ───────────────────────────────────────
export async function getAvailableAddons() {
  return prisma.planAddon.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
}

export async function getTenantAddons(tenantId: string) {
  return prisma.tenantAddon.findMany({
    where: { tenantId, active: true },
    include: { addon: true },
  });
}

export async function purchaseAddon(tenantId: string, addonSlug: string, quantity = 1) {
  const addon = await prisma.planAddon.findUnique({ where: { slug: addonSlug } });
  if (!addon || !addon.active) throw new Error('Addon not found or inactive');

  const existing = await prisma.tenantAddon.findUnique({ where: { tenantId_addonId: { tenantId, addonId: addon.id } } });
  if (existing) {
    return prisma.tenantAddon.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity, active: true, endDate: null },
      include: { addon: true },
    });
  }

  return prisma.tenantAddon.create({
    data: { tenantId, addonId: addon.id, quantity },
    include: { addon: true },
  });
}

export async function cancelAddon(tenantId: string, addonSlug: string) {
  const addon = await prisma.planAddon.findUnique({ where: { slug: addonSlug } });
  if (!addon) throw new Error('Addon not found');
  await prisma.tenantAddon.updateMany({
    where: { tenantId, addonId: addon.id },
    data: { active: false, endDate: new Date() },
  });
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

  // Trial logic
  const trialEndsAt = plan.trialDays > 0
    ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    : null;

  const subscription = await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      cancelledAt: null,
    },
    create: {
      tenantId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
    },
    include: { plan: true },
  });

  // Sync ALL tenant limits from plan
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      plan: plan.code,
      maxUsers: plan.maxUsers,
      maxDrivers: plan.maxDrivers,
      maxShipments: plan.maxShipments,
      maxBranches: plan.maxBranches,
      maxHubs: plan.maxHubs,
      maxOrganizations: plan.maxOrganizations,
      maxStorageMb: plan.maxStorageMb,
    },
  });

  // Auto-generate invoice for paid plans (skip during trial)
  if (plan.priceMonthly > 0 && (!trialEndsAt || now >= trialEndsAt)) {
    try {
      await generateInvoice(tenantId);
    } catch (e) {
      log.warn('Failed to auto-generate invoice', { tenantId, error: e });
    }
  }

  log.info('Subscription created/updated', { tenantId, plan: plan.code, cycle: billingCycle, trial: !!trialEndsAt });
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
        maxBranches: freePlan.maxBranches,
        maxHubs: freePlan.maxHubs,
        maxOrganizations: freePlan.maxOrganizations,
        maxStorageMb: freePlan.maxStorageMb,
      },
    });

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

export async function isTrialActive(tenantId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub?.trialEndsAt) return false;
  return new Date() < sub.trialEndsAt && sub.status === 'ACTIVE';
}

// ─── Usage Tracking ──────────────────────────────────────
export async function recordUsage(tenantId: string, metric: string, quantity: number) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) return;

  // Upsert to avoid duplicates per period
  await prisma.usageRecord.upsert({
    where: { tenantId_metric_periodStart: { tenantId, metric, periodStart: sub.currentPeriodStart } },
    update: { quantity: { increment: quantity } },
    create: {
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

  const [users, drivers, shipments, branches, hubs, organizations] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.driver.count({ where: { tenantId } }),
    prisma.shipment.count({ where: { tenantId } }),
    prisma.branch.count({ where: { tenantId } }),
    prisma.hub.count({ where: { tenantId } }),
    prisma.organization.count({ where: { tenantId } }),
  ]);

  return {
    plan: sub.plan,
    subscription: sub,
    usage: { ...usage, users, drivers, shipments, branches, hubs, organizations },
    limits: {
      maxUsers: sub.plan.maxUsers,
      maxDrivers: sub.plan.maxDrivers,
      maxShipments: sub.plan.maxShipments,
      maxBranches: sub.plan.maxBranches,
      maxHubs: sub.plan.maxHubs,
      maxOrganizations: sub.plan.maxOrganizations,
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
      dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
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

// ─── Helpers ─────────────────────────────────────────────
export { PLAN_DEFINITIONS, PLAN_ORDER };

export const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  PRO: 'Professional',
  ENTERPRISE: 'Enterprise',
};

// ─── Route → Feature Mapping ─────────────────────────────
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/control-tower': 'control_tower',
  '/dispatch': 'dispatch',
  '/reports': 'reports',
  '/analytics': 'reports',
  '/sla': 'sla',
  '/exceptions': 'sla',
  '/integrations': 'integrations',
  '/map': 'gps_tracking',
  '/warehouses': 'warehouse_management',
  '/geofences': 'geofencing',
  '/organizations': 'branch_management',
  '/regions': 'branch_management',
  '/branches': 'branch_management',
  '/departments': 'branch_management',
  '/hubs': 'branch_management',
};
