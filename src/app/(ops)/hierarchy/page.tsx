import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HierarchyDashboard from './HierarchyDashboard';

export const metadata: Metadata = { title: 'Hierarchy Dashboard | DTMS' };

export default async function HierarchyPage() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#101828]">Hierarchy Dashboard</h1>
          <p className="mt-1 text-sm text-[#667085]">Pilih tenant untuk melihat seluruh struktur hierarki: Organization, Region, Branch, Department, dan Hub.</p>
        </div>
      </div>
      <HierarchyDashboard />
    </div>
  );
}
