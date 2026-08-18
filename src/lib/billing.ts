// src/lib/billing.ts
// Subscription & billing service.
import { prisma } from './prisma';
import { logger } from './logger';

const log = logger.child('billing');

// ─── Plan Management ─────────────────────────────────────
export async function getPlans() {
  return prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTenantSubscription(tenantId: string) {
  return prisma.subscription.findUnique({
    where: { tenantId },
    include: {
      plan: true,
      invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
}

// ─── Subscription Lifecycle ───────────────────────────────
export async function createSubscription(tenantId: string, planCode: string, billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') {
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

  log.info('Subscription created/updated', { tenantId, plan: plan.code, cycle: billingCycle });
  return subscription;
}

export async function cancelSubscription(tenantId: string) {
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  if (!sub) throw new Error('No subscription found');

  await prisma.subscription.update({
    where: { tenantId },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  log.info('Subscription cancelled', { tenantId });
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

  const now = new Date();
  const count = await prisma.invoice.count({ where: { tenantId } });
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

  const amount = sub.billingCycle === 'MONTHLY' ? sub.plan.priceMonthly : sub.plan.priceYearly;
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
export async function seedPlans() {
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
