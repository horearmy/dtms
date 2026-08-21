import type { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DriverDashboard from './DriverDashboard';

export const metadata: Metadata = { title: 'Driver Dashboard | DTMS' };

export default async function DriverPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'DRIVER') redirect('/dashboard');

  return <DriverDashboard />;
}
