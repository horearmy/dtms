import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SecurityDashboard from './SecurityDashboard';
import AdminSessionsPanel from './AdminSessionsPanel';

export const metadata: Metadata = { title: 'Security Dashboard | DTMS' };

export default async function SecurityPage() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') redirect('/dashboard');
  return (
    <div className="space-y-8">
      <SecurityDashboard />
      <AdminSessionsPanel />
    </div>
  );
}
