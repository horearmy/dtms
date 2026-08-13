import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/constants';
import GpsSender from '@/components/GpsSender';
import LogoutButton from '@/components/LogoutButton';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'DRIVER') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 bg-brand-700 shadow">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">DT</div>
          <div>
            <div className="text-sm font-bold text-white">Driver App</div>
            <div className="text-[11px] text-brand-100">{session.name} · {ROLE_LABELS[session.role]}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <GpsSender />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}