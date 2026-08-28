import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cacheData, CACHE_TAGS } from '@/lib/cache';
import OpsShell from '@/components/OpsShell';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'DRIVER') redirect('/driver');

  // Plan & features sudah dibawa JWT oleh getSession(), hindari query berulang.
  const tenantPlan = session.plan ?? null;
  const planFeatures = session.planFeatures ?? [];

  let whiteLabel: { appName: string | null; logoUrl: string | null; primaryColor: string | null } | null = null;
  if (session.tenantId) {
    const getWhiteLabel = cacheData(
      async () => prisma.whiteLabel.findUnique({
        where: { tenantId: session.tenantId! },
        select: { appName: true, logoUrl: true, primaryColor: true },
      }),
      [CACHE_TAGS.TENANT_META, session.tenantId],
      { revalidate: 60, tags: [CACHE_TAGS.TENANT_META] }
    );
    whiteLabel = await getWhiteLabel();
  }

  return (
    <OpsShell name={session.name} role={session.role} tenantPlan={tenantPlan} planFeatures={planFeatures} whiteLabel={whiteLabel}>
      {children}
    </OpsShell>
  );
}