import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RegionList from './RegionList';

export const metadata: Metadata = { title: 'Region Management | DTMS' };

export default async function RegionsPage() {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) redirect('/dashboard');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Region Management</h1>
          <p className="mt-1 text-sm text-[#667085]">Kelola region geografis dan organisasi operasional.</p>
        </div>
      </div>
      <RegionList />
    </div>
  );
}
