import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import OpsShell from '@/components/OpsShell';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'DRIVER') redirect('/driver');

  const superAdminPages = ['/tenants', '/demo-requests', '/audit', '/billing', '/integrations'];

  let tenantPlan: string | null = null;
  if (session.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { plan: true } });
    tenantPlan = tenant?.plan ?? null;
  }

  return (
    <OpsShell name={session.name} role={session.role} tenantPlan={tenantPlan}>
      {children}
    </OpsShell>
  );
}