import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ROLE_LABELS } from '@/lib/constants';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import GpsSender from '@/components/GpsSender';
import GpsStatus from '@/components/GpsStatus';
import LogoutButton from '@/components/LogoutButton';
import { Package, ClipboardList, User } from 'lucide-react';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'DRIVER') redirect('/dashboard');

  const driver = await prisma.driver.findFirst({
    where: { userId: session.id },
    select: { photo: true, name: true, employeeId: true, phone: true },
  });

  const displayName = driver?.name || session.name;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <ServiceWorkerRegister />
      <header className="sticky top-0 z-40 bg-[#061B41] shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D6EFD] font-bold text-white">DT</div>
          <div>
            <div className="text-sm font-bold text-white">Driver App</div>
            <div className="text-[11px] text-blue-200">{session.name} · {ROLE_LABELS[session.role]}</div>
          </div>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link href="/driver" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
              Tugas
            </Link>
            <Link href="/driver/laporan" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
              Laporan
            </Link>
            <Link href="/account/password" className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10">
              Ganti Password
            </Link>
            <GpsStatus />
            <GpsSender />
            <LogoutButton />
          </div>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <GpsStatus />
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="border-b border-[#E4E7EC] bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-6">
          {driver?.photo ? (
            <img src={driver.photo} alt={displayName} className="h-20 w-20 rounded-full border-4 border-[#E7F0FF] object-cover shadow-sm" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#E7F0FF] bg-[#0D6EFD] text-xl font-bold text-white shadow-sm">
              {initial}
            </div>
          )}
          <div className="text-center">
            <div className="text-base font-bold text-[#101828]">{displayName}</div>
            <div className="text-xs text-[#667085]">{driver?.employeeId ? `${driver.employeeId} · ` : ''}{ROLE_LABELS[session.role] || 'Driver'}{driver?.phone ? ` · ${driver.phone}` : ''}</div>
          </div>
          <div className="flex items-center gap-2 pt-1 lg:hidden">
            <GpsSender />
            <span className="text-[10px] text-[#667085]">Geser bawah untuk akses menu</span>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-3xl p-4 pb-20 lg:pb-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#E4E7EC] bg-white px-2 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:hidden">
        <Link href="/driver" className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[#0D6EFD]">
          <Package size={20} />
          <span className="text-[10px] font-semibold">Tugas</span>
        </Link>
        <Link href="/driver/laporan" className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[#667085]">
          <ClipboardList size={20} />
          <span className="text-[10px] font-semibold">Laporan</span>
        </Link>
        <Link href="/account/password" className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-[#667085]">
          <User size={20} />
          <span className="text-[10px] font-semibold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
