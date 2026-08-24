import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PlanTenants from './PlanTenants';

export const metadata: Metadata = { title: 'Detail Plan | DTMS' };

export default async function PlanDetailPage({ params }: { params: Promise<{ planCode: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/dashboard');
  const { planCode } = await params;

  return <PlanTenants planCode={decodeURIComponent(planCode).toUpperCase()} />;
}
