import Link from 'next/link';
import { ROLE_LABELS } from '@/lib/constants';
import SearchBox from './SearchBox';
import NotificationsBell from './NotificationsBell';
import LogoutButton from './LogoutButton';

export default function Header({ name, role, onMenuClick }: { name: string; role: string; onMenuClick?: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-brand-700 shadow">
      <div className="flex items-center gap-4 px-4 py-3">
        {onMenuClick && (
          <button onClick={onMenuClick} aria-label="Buka menu navigasi" className="lg:hidden rounded-lg p-1.5 text-white hover:bg-white/10">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="text-sm font-bold text-white lg:hidden">DTMS</div>
        <SearchBox />
        <div className="ml-auto flex items-center gap-3">
          <Link href="/account/security" className="hidden rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 sm:block">
            Keamanan
          </Link>
          <Link href="/account/password" className="hidden rounded-lg border border-white/30 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 sm:block">
            Ganti Password
          </Link>
          <NotificationsBell />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-white">{name}</div>
            <div className="text-[11px] text-brand-100">{ROLE_LABELS[role] || role}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}