import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/constants';
import GpsSender from '@/components/GpsSender';
import GpsStatus from '@/components/GpsStatus';
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
            <Link href="/driver" className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
              Tugas
            </Link>
            <Link href="/driver/laporan" className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
              📋 Laporan
            </Link>
            <Link href="/account/password" className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
              Ganti Password
            </Link>
            <GpsStatus />
            <GpsSender />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}