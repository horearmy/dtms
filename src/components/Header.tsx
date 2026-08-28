'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  MessageSquare,
  Maximize2,
  Minimize2,
  ChevronDown,
  Shield,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';
import NotificationsBell from './NotificationsBell';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/shipments': 'Pengiriman',
  '/tracking': 'Lacak Pengiriman',
  '/customers': 'Pelanggan',
  '/drivers': 'Kurir',
  '/vehicles': 'Kendaraan',
  '/geofences': 'Geofencing',
  '/reports': 'Laporan',
  '/analytics': 'Analitik',
  '/users': 'Pengguna',
  '/audit': 'Audit Log',
  '/tenants': 'Tenants',
  '/map': 'Live Tracking',
  '/warehouse/scan': 'Warehouse Scan',
  '/settings/whatsapp': 'Pengaturan WhatsApp',
  '/settings/profile': 'Profil Perusahaan',
  '/security': 'Security Dashboard',
  '/notifications': 'Notifikasi',
  '/warehouses': 'Gudang',
  '/roles': 'Roles & Permissions',
  '/organizations': 'Organizations',
  '/regions': 'Regions',
  '/branches': 'Branches',
  '/departments': 'Departemen',
  '/hubs': 'Hub',
};

type WhiteLabel = { appName: string | null; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null; accentColor: string | null } | null;

export default function Header({ name, role, whiteLabel, onMenuClick }: { name: string; role: string; whiteLabel?: WhiteLabel; onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pageTitle = Object.entries(PAGE_TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1] || 'Dashboard';

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shipments?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  }

  return (
    <header className="sticky top-0 z-30 border-b border-t-2 border-[#E4E7EC] bg-white" style={{ borderTopColor: 'var(--brand-accent)' }}>
      <div className="flex items-center gap-4 px-4 py-3 lg:px-6">
        {/* Left: Hamburger + Title */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Buka menu navigasi"
            className="rounded-lg p-1.5 text-[#667085] hover:bg-gray-100 lg:hidden"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-lg font-bold text-[#101828]">{pageTitle}</h1>

        {/* Center: Search */}
        <form onSubmit={handleSearch} className="mx-auto hidden max-w-md flex-1 md:block">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              id="header-search"
              name="shipmentSearch"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari resi, nama penerima, lokasi..."
              className="w-full rounded-lg border border-[#E4E7EC] bg-[#F7F9FC] py-2 pl-10 pr-3 text-sm text-[#101828] placeholder:text-[#667085] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]"
            />
          </div>
        </form>

        {/* Right: Actions */}
        <div className="ml-auto flex items-center gap-1">
          <NotificationsBell />

          {/* Message Badge */}
          <button className="relative rounded-lg p-2 text-[#667085] hover:bg-gray-100">
            <MessageSquare size={18} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="rounded-lg p-2 text-[#667085] hover:bg-gray-100"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* User Dropdown */}
          <details className="relative">
            <summary className="flex max-w-[min(16rem,calc(100vw-8rem))] cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
             <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'var(--brand-primary)' }}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                <div className="max-w-32 truncate text-sm font-semibold text-[#101828]" title={name}>{name}</div>
                <div className="text-[11px] text-[#667085]">{ROLE_LABELS[role] || role}</div>
              </div>
              <ChevronDown size={14} className="hidden text-[#667085] sm:block" />
            </summary>

            <div role="menu" className="absolute right-0 z-50 mt-2 w-[min(14rem,calc(100vw-2rem))] rounded-xl border border-[#E4E7EC] bg-white py-1 shadow-lg">
                <div className="border-b border-[#E4E7EC] px-4 py-3">
                  <div className="break-words text-sm font-semibold text-[#101828]">{name}</div>
                  <div className="text-xs text-[#667085]">{ROLE_LABELS[role] || role}</div>
                </div>
                <div className="py-1">
                  <Link
                    href="/account/security"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#667085] hover:bg-gray-50 hover:text-[#101828]"
                  >
                    <Shield size={16} />
                    Keamanan
                  </Link>
                  <Link
                    href="/account/password"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#667085] hover:bg-gray-50 hover:text-[#101828]"
                  >
                    <KeyRound size={16} />
                    Ganti Password
                  </Link>
                </div>
                <div className="border-t border-[#E4E7EC] py-1">
                  <a
                    href="/api/auth/logout"
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-[#F5222D] hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Keluar
                  </a>
                </div>
              </div>
          </details>
        </div>
      </div>
    </header>
  );
}
