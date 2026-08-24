import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BillingConsole from './BillingConsole';

export const metadata: Metadata = { title: 'Billing Management | DTMS' };

export default async function BillingManagementPage() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Billing Management</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Konsol billing enterprise — KPI pendapatan, plan &amp; pelanggan, invoice, kontrak, dan billing run periodik.
        </p>
      </div>
      <BillingConsole />
    </div>
  );
}
