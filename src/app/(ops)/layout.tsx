import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'DRIVER') redirect('/driver');

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar role={session.role} />
      <div className="lg:pl-60">
        <Header name={session.name} role={session.role} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}