import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { cancelSubscription, generateInvoice, getTenantSubscription } from '@/lib/billing';
import { setSession } from '@/lib/auth';

// POST — cancel subscription (downgrade to FREE)
export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.BILLING.MANAGE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    try {
      const oldSub = await getTenantSubscription(session?.tenantId || '');
      await cancelSubscription(session?.tenantId || '');

      // Re-issue JWT so middleware picks up FREE plan features immediately
      await setSession({
        id: session!.id,
        name: session!.name,
        username: session!.username,
        role: session!.role,
        tenantId: session!.tenantId,
        branchId: session!.branchId,
        mustChangePassword: session!.mustChangePassword,
      });

      await logAudit(session, 'CANCEL_SUBSCRIPTION', 'BILLING', {
        oldData: oldSub ? { plan: oldSub.plan.code } : null,
        newData: { plan: 'FREE' },
      }, req);

      return NextResponse.json({ success: true, message: 'Subscription dibatalkan. Plan dikembalikan ke Free.' });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Gagal' }, { status: 400 });
    }
  });
}
