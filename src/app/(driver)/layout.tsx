'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, FileText, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/driver', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { href: '/driver/tasks', label: 'Tugas', icon: <ClipboardList size={18} /> },
  { href: '/driver/laporan', label: 'Laporan', icon: <FileText size={18} /> },
  { href: '/driver/profile', label: 'Profil', icon: <User size={18} /> },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">D</div>
          <span className="text-sm font-bold text-gray-900">DTMS Driver</span>
        </div>
        <Link href="/api/auth/logout" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
          <LogOut size={18} />
        </Link>
      </div>

      {/* Content */}
      <main className="pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-lg justify-around py-2">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== '/driver' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1 text-xs',
                  active ? 'text-blue-600' : 'text-gray-400'
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
