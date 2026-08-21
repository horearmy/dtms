import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BranchList from './BranchList';

export const metadata: Metadata = { title: 'Branch Management | DTMS' };

export default async function BranchesPage() {
  const session = await getSession();
  if (!session || !['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(session.role)) redirect('/dashboard');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Branch Management</h1>
          <p className="mt-1 text-sm text-[#667085]">Kelola cabang, gudang, dan unit operasional di berbagai wilayah.</p>
        </div>
      </div>
      <BranchList />
    </div>
  );
}
