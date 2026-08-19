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
  if (session.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { plan: true } });
    tenantPlan = tenant?.plan ?? null;
    planFeatures = await getTenantFeatures(session.tenantId);
  }

  return (
    <OpsShell name={session.name} role={session.role} tenantPlan={tenantPlan} planFeatures={planFeatures}>
      {children}
    </OpsShell>
  );
}