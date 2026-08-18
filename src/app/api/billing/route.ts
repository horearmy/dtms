import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { getPlans, getTenantSubscription, getUsageSummary, createSubscription, generateInvoice } from '@/lib/billing';
import { startMetricsCollector } from '@/lib/metrics';

// Start metrics collector on first import
startMetricsCollector();

// GET — plans + current subscription + usage
export async function GET() {
  const { session, scope, error } = await guardPermission(PERMISSIONS.BILLING.READ);
  if (error) return error;

  const [plans, subscription, usage] = await Promise.all([
    getPlans(),
    session?.tenantId ? getTenantSubscription(session.tenantId) : null,
    session?.tenantId ? getUsageSummary(session.tenantId) : null,
  ]);

  return NextResponse.json({ plans, subscription, usage });
}

// POST — subscribe to plan
export async function POST(req: NextRequest) {
  const { session, scope, error } = await guardPermission(PERMISSIONS.BILLING.MANAGE);
  if (error) return error;

  const body = await req.json();
  const { planCode, billingCycle } = body;

  if (!planCode) {
    return NextResponse.json({ error: 'planCode wajib' }, { status: 400 });
  }

  try {
    const subscription = await createSubscription(session?.tenantId || '', planCode, billingCycle);
    return NextResponse.json(subscription);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Gagal' }, { status: 400 });
  }
}
