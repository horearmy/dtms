import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, guard, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';
import { getAvailableAddons, getTenantAddons, purchaseAddon } from '@/lib/billing';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const [available, tenantAddons] = await Promise.all([
      getAvailableAddons(),
      session?.tenantId ? getTenantAddons(session.tenantId) : [],
    ]);

    return NextResponse.json({
      addons: available,
      activeAddons: tenantAddons,
    });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.BILLING.MANAGE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    const { addonSlug, quantity } = body;

    if (!addonSlug) {
      return NextResponse.json({ error: 'addonSlug wajib' }, { status: 400 });
    }

    try {
      const addon = await purchaseAddon(session?.tenantId || '', addonSlug, quantity || 1);

      await logAudit(session, 'PURCHASE_ADDON', 'BILLING', {
        newData: { addon: addonSlug, quantity: quantity || 1 },
      }, req);

      return NextResponse.json({ addon });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Gagal' }, { status: 400 });
    }
  });
}
