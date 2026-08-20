import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OrganizationList from './OrganizationList';

export const metadata: Metadata = { title: 'Organization Management | DTMS' };

export default async function OrganizationsPage() {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) redirect('/dashboard');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Organization Management</h1>
          <p className="mt-1 text-sm text-[#667085]">Kelola organisasi, divisi bisnis, dan struktur hierarki tenant.</p>
        </div>
      </div>
      <OrganizationList />
    </div>
  );
}
