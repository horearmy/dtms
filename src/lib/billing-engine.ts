// src/lib/billing-engine.ts
// Enterprise Billing Engine (spec: docs/DTMS_ENTERPRISE_BILLING.md)
// Phase 1+2: pricing components, contract, idempotent billing run,
// invoice lifecycle (issue/void), payment recording, dashboard KPI.
import { prisma } from './prisma';
import { logger } from './logger';
import { PPN_RATE } from './plan-constants';

const log = logger.child('billing-engine');

const DEFAULT_TAX_RATE = PPN_RATE;
const DEFAULT_PAYMENT_TERMS_DAYS = 14;

export type LineItem = {
  code: string;
  name: string;
  chargeType: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  lineTotal: number;
};

export function computePeriodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(year: number, month1to12: number) {
  const periodStart = new Date(Date.UTC(year, month1to12 - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
  return { periodStart, periodEnd };
}

/** Prorated Charge = Price × Active Days / Total Days (spec §11) */
export function prorate(price: number, activeDays: number, totalDays: number): number {
  if (totalDays <= 0) return 0;
  return Math.round((price * Math.min(activeDays, totalDays)) / totalDays);
}

async function resolveTaxRate(): Promise<number> {
  const rule = await prisma.taxRule.findFirst({
    where: { status: 'ACTIVE', effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: 'desc' },
  });
  return rule ? rule.rate : DEFAULT_TAX_RATE;
}

function buildLineItems(
  plan: { priceMonthly: number; priceYearly: number; name: string },
  billingCycle: string,
  components: Array<{ code: string; name: string; chargeType: string; unitPrice: number; minQuantity: number; maxQuantity: number | null; taxable: boolean }>,
  usageByMetric: Map<string, number>
): { items: LineItem[]; subtotal: number; taxBase: number } {
  const items: LineItem[] = [];

  // Fallback bila plan belum memiliki price components:
  // satu komponen FIXED berdasarkan harga plan sesuai siklus tagihan.
  if (components.length === 0) {
    const amount = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    if (amount > 0) {
      items.push({
        code: 'BASE_SUBSCRIPTION',
        name: `${plan.name} (${billingCycle === 'YEARLY' ? 'Tahunan' : 'Bulanan'})`,
        chargeType: 'FIXED',
        quantity: 1,
        unitPrice: amount,
        taxable: true,
        lineTotal: amount,
      });
    }
  } else {
    for (const c of components) {
      let qty = c.minQuantity;
      if (c.chargeType !== 'FIXED') {
        const used = usageByMetric.get(c.code);
        if (used !== undefined) qty = Math.max(qty, used);
      } else {
        qty = 1;
      }
      if (c.maxQuantity != null) qty = Math.min(qty, c.maxQuantity);
      const lineTotal = Math.round(qty * c.unitPrice);
      if (lineTotal === 0 && c.chargeType === 'CUSTOM_USAGE') continue;
      items.push({
        code: c.code,
        name: c.name,
        chargeType: c.chargeType,
        quantity: qty,
        unitPrice: c.unitPrice,
        taxable: c.taxable,
        lineTotal,
      });
    }
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const taxBase = items.filter((i) => i.taxable).reduce((s, i) => s + i.lineTotal, 0);
  return { items, subtotal, taxBase };
}

async function nextSequence(periodKey: string): Promise<number> {
  const [y, m] = periodKey.split('-');
  const start = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  const end = new Date(Date.UTC(Number(y), Number(m), 1));
  return prisma.invoice.count({
    where: { billingPeriodStart: { gte: start, lt: end } },
  });
}

function buildInvoiceNumber(tenantCode: string, d: Date, seq: number): string {
  // Format spec §12: INV/DTMS/{TENANT_CODE}/{YYYY}/{MM}/{SEQUENCE}
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `INV/DTMS/${tenantCode}/${y}/${m}/${String(seq).padStart(6, '0')}`;
}

export type BillingRunResult = {
  runId: string;
  periodKey: string;
  status: string;
  totalTenants: number;
  totalInvoices: number;
  totalAmount: number;
  errorCount: number;
  skippedExisting?: boolean;
};

/**
 * Jalankan billing run untuk satu periode bulanan.
 * Idempotent: satu BillingRun per (periodKey, runType); invoice duplikat
 * dicegah oleh unique constraint (subscriptionId, periodKey).
 */
export async function executeBillingRun(opts: {
  year: number;
  month: number;
  runType?: string;
  actor?: string;
}): Promise<BillingRunResult> {
  const runType = opts.runType || 'MANUAL';
  const { periodStart, periodEnd } = monthBounds(opts.year, opts.month);
  const periodKey = computePeriodKey(periodStart);

  // Idempotency di level run
  const existingRun = await prisma.billingRun.findUnique({
    where: { periodKey_runType: { periodKey, runType } },
  });
  if (existingRun && existingRun.status === 'COMPLETED') {
    return {
      runId: existingRun.id,
      periodKey,
      status: existingRun.status,
      totalTenants: existingRun.totalTenants,
      totalInvoices: existingRun.totalInvoices,
      totalAmount: existingRun.totalAmount,
      errorCount: existingRun.errorCount,
      skippedExisting: true,
    };
  }

  const run =
    existingRun ||
    (await prisma.billingRun.create({
      data: { periodStart, periodEnd, periodKey, runType, status: 'RUNNING', startedAt: new Date(), triggeredBy: opts.actor },
    }));
  await prisma.billingRun.update({ where: { id: run.id }, data: { status: 'RUNNING', startedAt: run.startedAt ?? new Date() } });

  const taxRate = await resolveTaxRate();
  const subs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', plan: { is: { priceMonthly: { gt: 0 } } } },
    include: { plan: { include: { priceComponents: { where: { status: 'ACTIVE' } } } }, tenant: { select: { code: true, slug: true } } },
  });

  let created = 0;
  let totalAmount = 0;
  let errors = 0;

  for (const sub of subs) {
    try {
      const dup = await prisma.invoice.findFirst({
        where: { subscriptionId: sub.id, periodKey },
        select: { id: true },
      });
      if (dup) continue;

      const usageRows = await prisma.usageRecord.groupBy({
        by: ['metric'],
        where: { tenantId: sub.tenantId, recordedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { quantity: true },
      });
      const usageByMetric = new Map<string, number>(usageRows.map((r) => [r.metric, r._sum.quantity ?? 0]));

      const { items, subtotal, taxBase } = buildLineItems(
        sub.plan,
        sub.billingCycle,
        sub.plan.priceComponents,
        usageByMetric
      );
      if (subtotal <= 0) continue;

      const tax = Math.round(taxBase * taxRate);
      const total = subtotal + tax;
      const seq = (await nextSequence(periodKey)) + 1;
      const tenantCode = sub.tenant.code || sub.tenant.slug.slice(0, 10).toUpperCase();
      const invoiceNumber = buildInvoiceNumber(tenantCode, periodStart, seq);
      const termsDays = DEFAULT_PAYMENT_TERMS_DAYS;
      const dueDate = new Date(periodEnd.getTime() + termsDays * 86400000);

      await prisma.invoice.create({
        data: {
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          invoiceNumber,
          status: 'ISSUED',
          issuedAt: new Date(),
          subtotal,
          discountAmount: 0,
          tax,
          total,
          paidAmount: 0,
          periodKey,
          dueDate,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          currency: sub.plan.currency,
          lineItems: JSON.stringify(items),
        },
      });
      created += 1;
      totalAmount += total;
    } catch (e: unknown) {
      // P2002 = sudah ada invoice untuk sub+periode ini (race/idempotent)
      if ((e as { code?: string }).code === 'P2002') continue;
      errors += 1;
      log.error('billing run item failed', { tenantId: sub.tenantId, err: String(e) });
    }
  }

  const done = await prisma.billingRun.update({
    where: { id: run.id },
    data: {
      status: errors > 0 ? 'PARTIAL' : 'COMPLETED',
      completedAt: new Date(),
      totalTenants: subs.length,
      totalInvoices: created,
      totalAmount,
      errorCount: errors,
    },
  });

  log.info('billing run completed', { periodKey, created, totalAmount, errors });
  return {
    runId: done.id,
    periodKey,
    status: done.status,
    totalTenants: done.totalTenants,
    totalInvoices: done.totalInvoices,
    totalAmount: done.totalAmount,
    errorCount: done.errorCount,
  };
}

/** Terbitkan invoice DRAFT (immutable setelah ISSUED — spec §2.3). */
export async function issueInvoice(invoiceId: string, actor?: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new Error('Invoice tidak ditemukan');
  if (inv.status !== 'DRAFT') throw new Error('Hanya invoice DRAFT yang dapat diterbitkan');
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'ISSUED', issuedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { action: 'ISSUE_INVOICE', module: 'BILLING', newData: JSON.stringify({ invoiceNumber: inv.invoiceNumber }), userId: actor },
  });
  return updated;
}

/** Void invoice (tidak menghapus data fisik — spec business rule #15). */
export async function voidInvoice(invoiceId: string, reason: string, actor?: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) throw new Error('Invoice tidak ditemukan');
  if (['PAID', 'VOID'].includes(inv.status)) throw new Error(`Invoice berstatus ${inv.status} tidak dapat di-void`);
  if (inv.payments.some((p) => p.status === 'SUCCESS')) throw new Error('Invoice dengan pembayaran berhasil tidak dapat di-void');
  if (!reason || reason.trim().length < 3) throw new Error('Alasan void wajib diisi');

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'VOID' },
  });
  await prisma.auditLog.create({
    data: { action: 'VOID_INVOICE', module: 'BILLING', oldData: JSON.stringify({ status: inv.status }), newData: JSON.stringify({ reason }), userId: actor },
  });
  return updated;
}

/**
 * Catat pembayaran sukses terhadap invoice + alokasi ke outstanding.
 * Mendukung partial payment. Reference harus unik (idempotency).
 */
export async function recordPayment(opts: {
  invoiceId: string;
  amount: number;
  method?: string;
  reference?: string;
  actor?: string;
}) {
  const inv = await prisma.invoice.findUnique({ where: { id: opts.invoiceId } });
  if (!inv) throw new Error('Invoice tidak ditemukan');
  if (['VOID', 'CANCELLED'].includes(inv.status)) throw new Error('Invoice void/dibatalkan tidak dapat dibayar');

  const outstanding = Math.max(0, Math.round(inv.total - inv.discountAmount - inv.paidAmount));
  const amount = Math.round(opts.amount);
  if (!(amount > 0)) throw new Error('Nominal pembayaran harus lebih dari 0');
  if (amount > outstanding) throw new Error(`Melebihi outstanding (Rp ${outstanding.toLocaleString('id-ID')})`);

  if (opts.reference) {
    const dupRef = await prisma.payment.findFirst({
      where: { reference: opts.reference, status: 'SUCCESS', invoiceId: { not: opts.invoiceId } },
      select: { id: true },
    });
    if (dupRef) throw new Error('Payment reference sudah digunakan');
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId: inv.tenantId,
        invoiceId: inv.id,
        amount,
        currency: inv.currency,
        method: opts.method || 'BANK_TRANSFER',
        reference: opts.reference || null,
        status: 'SUCCESS',
        paidAt: new Date(),
      },
    });
    const paidAmount = inv.paidAmount + amount;
    const newOutstanding = Math.max(0, Math.round(inv.total - inv.discountAmount - paidAmount));
    const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    const invoice = await tx.invoice.update({
      where: { id: inv.id },
      data: { paidAmount, status: newStatus, paidAt: newOutstanding <= 0 ? new Date() : null },
    });
    return { payment, invoice };
  });

  await prisma.auditLog.create({
    data: {
      action: 'RECORD_PAYMENT',
      module: 'BILLING',
      newData: JSON.stringify({ invoiceNumber: inv.invoiceNumber, amount, method: opts.method }),
      userId: opts.actor,
    },
  });
  return result;
}

export type BillingDashboard = Awaited<ReturnType<typeof getBillingDashboard>>;

export async function getBillingDashboard() {
  const now = new Date();
  const ninetyAgo = new Date(now.getTime() - 90 * 86400000);

  const [plans, activeSubs, statusCounts] = await Promise.all([
    prisma.plan.findMany(),
    prisma.subscription.findMany({ where: { status: 'ACTIVE' }, select: { planId: true, billingCycle: true } }),
    prisma.invoice.groupBy({ by: ['status'], _count: true, _sum: { total: true, paidAmount: true } }),
  ]);
  const planMap = new Map(plans.map((p) => [p.id, p]));

  let mrr = 0;
  for (const s of activeSubs) {
    const plan = planMap.get(s.planId);
    if (!plan) continue;
    mrr += s.billingCycle === 'YEARLY' ? plan.priceYearly / 12 : plan.priceMonthly;
  }
  mrr = Math.round(mrr);
  const activeSubscriptions = activeSubs.length;
  const arpu = activeSubscriptions > 0 ? Math.round(mrr / activeSubscriptions) : 0;

  const openInvoices = await prisma.invoice.findMany({
    where: { status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID'] } },
    select: { total: true, discountAmount: true, paidAmount: true, dueDate: true },
  });
  let receivable = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  for (const inv of openInvoices) {
    const out = Math.max(0, Math.round(inv.total - inv.discountAmount - inv.paidAmount));
    receivable += out;
    if (inv.dueDate < now) {
      overdueAmount += out;
      overdueCount += 1;
    }
  }

  const recent = await prisma.invoice.aggregate({
    where: { createdAt: { gte: ninetyAgo }, status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] } },
    _sum: { total: true, paidAmount: true },
    _count: true,
  });
  const billedRecent = recent._sum.total ?? 0;
  const paidRecent = recent._sum.paidAmount ?? 0;
  const collectionRate = billedRecent > 0 ? Math.round((paidRecent / billedRecent) * 100) : 100;

  const trendRows = await prisma.$queryRawUnsafe<Array<{ ym: Date; revenue: number; invoices: bigint }>>(
    `SELECT DATE_TRUNC('month', "billingPeriodStart") AS ym,
            SUM("total")::bigint AS revenue,
            COUNT(*)::bigint AS invoices
     FROM "Invoice"
     WHERE "status" IN ('ISSUED','SENT','PAID','PARTIALLY_PAID')
       AND "billingPeriodStart" >= $1
     GROUP BY 1 ORDER BY 1 ASC`,
    new Date(now.getFullYear(), now.getMonth() - 5, 1)
  );
  const revenueTrend = trendRows.map((r) => ({
    month: computePeriodKey(new Date(r.ym)),
    revenue: Number(r.revenue),
    invoices: Number(r.invoices),
  }));

  const topRows = await prisma.invoice.groupBy({
    by: ['tenantId'],
    where: { status: { notIn: ['DRAFT', 'VOID', 'CANCELLED'] } },
    _sum: { total: true, paidAmount: true },
    _count: true,
    orderBy: { _sum: { total: 'desc' } },
    take: 10,
  });
  const tenants = topRows.length
    ? await prisma.tenant.findMany({
        where: { id: { in: topRows.map((t) => t.tenantId) } },
        select: { id: true, name: true, code: true, plan: true },
      })
    : [];
  const topTenants = topRows.map((t) => {
    const tn = tenants.find((x) => x.id === t.tenantId);
    return {
      tenantId: t.tenantId,
      tenantName: tn?.name || '(tanpa nama)',
      tenantCode: tn?.code || '-',
      planCode: tn?.plan || '-',
      billed: Math.round(t._sum.total ?? 0),
      paid: Math.round(t._sum.paidAmount ?? 0),
      invoices: t._count,
    };
  });

  const statusBreakdown = statusCounts.map((s) => ({
    status: s.status,
    count: s._count,
    amount: Math.round(s._sum.total ?? 0),
  }));

  return {
    kpi: {
      mrr,
      arr: mrr * 12,
      arpu,
      activeSubscriptions,
      receivable,
      overdueAmount,
      overdueCount,
      collectionRate,
      currency: 'IDR',
    },
    revenueTrend,
    statusBreakdown,
    topTenants,
  };
}
