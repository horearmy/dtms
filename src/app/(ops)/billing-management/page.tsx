import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BillingOverview from './BillingOverview';

export const metadata: Metadata = { title: 'Billing Management | DTMS' };

export default async function BillingManagementPage() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101828]">Billing Management</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Kelola paket berlangganan seluruh tenant — lihat distribusi plan, pendapatan, dan lakukan upgrade.
        </p>
      </div>
      <BillingOverview />
    </div>
  );
}
