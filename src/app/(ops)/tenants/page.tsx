import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TenantList from './TenantList';

export const metadata: Metadata = { title: 'Tenant Management | DTMS' };

export default async function TenantsPage() {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) redirect('/dashboard');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola perusahaan, branding, dan kuota penggunaan.</p>
        </div>
      </div>
      <TenantList />
    </div>
  );
}
