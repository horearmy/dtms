import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, guard, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { getPlans, getTenantSubscription, getUsageSummary, createSubscription } from '@/lib/billing';

// GET — plans + current subscription + usage (any authenticated user)
export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const [plans, subscription, usage] = await Promise.all([
      getPlans(),
      session?.tenantId ? getTenantSubscription(session.tenantId) : null,
      session?.tenantId ? getUsageSummary(session.tenantId) : null,
    ]);

    return NextResponse.json({ plans, subscription, usage });
  });
}

// POST — subscribe to plan
export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.BILLING.MANAGE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { planCode, billingCycle } = body;

    if (!planCode) {
      return NextResponse.json({ error: 'planCode wajib' }, { status: 400 });
    }

    const validCodes = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
    if (!validCodes.includes(planCode)) {
      return NextResponse.json({ error: 'Plan tidak valid' }, { status: 400 });
    }

    try {
      const oldSub = await getTenantSubscription(session?.tenantId || '');
      const subscription = await createSubscription(session?.tenantId || '', planCode, billingCycle);

      await logAudit(session, 'SUBSCRIBE_PLAN', 'BILLING', {
        oldData: oldSub ? { plan: oldSub.plan.code } : null,
        newData: { plan: planCode, cycle: billingCycle },
      }, req);

      return NextResponse.json(subscription);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Gagal' }, { status: 400 });
    }
  });
}
