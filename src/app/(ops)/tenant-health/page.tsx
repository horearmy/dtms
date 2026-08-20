import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TenantHealthDashboard from './TenantHealthDashboard';

export const metadata: Metadata = { title: 'Tenant Health Monitor | DTMS' };

export default async function TenantHealthPage() {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) redirect('/dashboard');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Tenant Health Monitor</h1>
        <p className="mt-1 text-sm text-[#667085]">Monitor kesehatan, penggunaan, dan aktivitas setiap tenant secara real-time.</p>
      </div>
      <TenantHealthDashboard />
    </div>
  );
}
