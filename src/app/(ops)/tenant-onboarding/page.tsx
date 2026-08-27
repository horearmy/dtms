import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TenantOnboardingView from './TenantOnboardingView';

export const metadata: Metadata = { title: 'Tenant Onboarding | DTMS' };

export default async function TenantOnboardingPage() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Tenant Onboarding</h1>
        <p className="mt-1 text-sm text-[#667085]">Pantau progress onboarding setiap tenant dari tahap awal hingga aktif.</p>
      </div>
      <TenantOnboardingView />
    </div>
  );
}
