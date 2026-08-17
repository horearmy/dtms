import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import OpsShell from '@/components/OpsShell';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'DRIVER') redirect('/driver');

  return (
    <OpsShell name={session.name} role={session.role}>
      {children}
    </OpsShell>
  );
}