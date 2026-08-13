import { ROLE_LABELS } from '@/lib/constants';
import SearchBox from './SearchBox';
import NotificationsBell from './NotificationsBell';
import LogoutButton from './LogoutButton';

export default function Header({ name, role }: { name: string; role: string }) {
  return (
    <header className="sticky top-0 z-40 bg-brand-700 shadow">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="text-sm font-bold text-white lg:hidden">DTMS</div>
        <SearchBox />
        <div className="ml-auto flex items-center gap-3">
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