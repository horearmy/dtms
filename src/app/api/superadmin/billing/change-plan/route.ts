import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/api-guard';
import { createSubscription, getTenantSubscription } from '@/lib/billing';

const VALID_CODES = ['FREE', 'STARTER', 'GROWTH', 'PRO', 'ENTERPRISE'];

// POST — ubah plan/billing cycle sebuah tenant (superadmin only)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const tenantId = String(body.tenantId || '');
  const planCode = String(body.planCode || '').toUpperCase();
  const billingCycle = body.billingCycle === 'YEARLY' ? 'YEARLY' as const : 'MONTHLY' as const;

  if (!tenantId || !planCode) {
    return NextResponse.json({ error: 'tenantId dan planCode wajib' }, { status: 400 });
  }
  if (!VALID_CODES.includes(planCode)) {
    return NextResponse.json({ error: 'Plan tidak valid' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 });
  }

  try {
    const oldSub = await getTenantSubscription(tenantId);
    const subscription = await createSubscription(tenantId, planCode, billingCycle);

    await logAudit(
      { id: session.id, name: session.name, username: session.username, role: session.role, tenantId: null, branchId: null },
      'SUPERADMIN_CHANGE_PLAN',
      'BILLING',
      {
        oldData: { tenant: tenant.name, plan: oldSub?.plan?.code ?? null },
        newData: { tenantId, tenant: tenant.name, plan: planCode, cycle: billingCycle },
      },
      req
    );

    return NextResponse.json({
      message: `Plan ${tenant.name} diubah ke ${planCode}`,
      subscription: {
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPeriodEnd: subscription.currentPeriodEnd,
        plan: { code: (subscription.plan as { code?: string })?.code ?? planCode, name: (subscription.plan as { name?: string })?.name ?? planCode },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengubah plan' },
      { status: 400 }
    );
  }
}
