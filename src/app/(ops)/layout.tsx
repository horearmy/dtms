import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantFeatures } from '@/lib/billing';
import OpsShell from '@/components/OpsShell';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'DRIVER') redirect('/driver');

  let tenantPlan: string | null = null;
  let planFeatures: string[] = [];
  let whiteLabel: { appName: string | null; logoUrl: string | null; primaryColor: string | null } | null = null;
  if (session.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { plan: true } });
    tenantPlan = tenant?.plan ?? null;
    planFeatures = await getTenantFeatures(session.tenantId);
    whiteLabel = await prisma.whiteLabel.findUnique({
      where: { tenantId: session.tenantId },
      select: { appName: true, logoUrl: true, primaryColor: true },
    });
  }

  return (
    <OpsShell name={session.name} role={session.role} tenantPlan={tenantPlan} planFeatures={planFeatures} whiteLabel={whiteLabel}>
      {children}
    </OpsShell>
  );
}