"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; icon: string };

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const opsRoles = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'WAREHOUSE', 'CUSTOMER_SERVICE', 'SUPERVISOR', 'MANAGEMENT'];

  const main: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
    { href: '/map', label: 'Live Tracking', icon: 'M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9a2 2 0 100-4 2 2 0 000 4z' },
    { href: '/tracking', label: 'Tracking Resi', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  ];

  const ops: NavItem[] = [
    { href: '/shipments', label: 'Shipment', icon: 'M20 7l-8-4-8 4v10l8 4 8-4V7zM12 3v18M4 7l8 4 8-4' },
    { href: '/customers', label: 'Customers', icon: 'M16 11a4 4 0 100-8 4 4 0 000 8zM3 21v-1a6 6 0 0112 0v1' },
    { href: '/drivers', label: 'Drivers', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a5 5 0 0112 0v1M17 15a5 5 0 014 5H17' },
    { href: '/vehicles', label: 'Vehicles', icon: 'M5 13l1.4-4.2A2 2 0 018.3 7h7.4a2 2 0 011.9 1.4L19 13M5 13h14v5H5v-5zm2 5v2M17 18v2M7 11h10' },
    { href: '/geofences', label: 'Geofencing', icon: 'M12 3a7 7 0 00-7 7c0 5 7 11 7 11s7-6 7-11a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1012 7a2.5 2.5 0 000 5.5z' },
    { href: '/warehouse/scan', label: 'Warehouse Scan', icon: 'M21 6h-2v2h-2V6h-2V4h2V2h2v2h2v2zm-9 3L9 14h6l-3-5zM5 14a3 3 0 100 6 3 3 0 000-6zm14 0a3 3 0 100 6 3 3 0 000-6z' },
    { href: '/reports', label: 'Reports', icon: 'M3 3v18h18M7 15l4-4 3 3 5-6' },
    { href: '/users', label: 'Users', icon: 'M5 13a4 4 0 100-8 4 4 0 000 8zM3 21v-1a5 5 0 0110 0v1M11 7a3 3 0 100-6 3 3 0 000 6zM17 12h5M19.5 9.5l-5 5M19.5 14.5l-5-5' },
    { href: '/audit', label: 'Audit Log', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const showOps = opsRoles.includes(role);
  const showUsers = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(role);

  function render(items: NavItem[], filter?: (i: NavItem) => boolean) {
    return items.filter(filter || (() => true)).map((item) => {
      const active = pathname === item.href || pathname.startsWith(item.href + '/');
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            active ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
          </svg>
          {item.label}
        </Link>
      );
    });
  }

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-brand-900 lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">DT</div>
        <div>
          <div className="text-sm font-bold text-white">DTMS</div>
          <div className="text-[11px] text-brand-200">Delivery Tracking</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-300">Menu</div>
        {render(main)}
        {showOps && (
          <>
            <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-brand-300">Operasional</div>
            {render(ops, (i) => (i.href === '/users' ? showUsers : true))}
          </>
        )}
      </nav>
      <div className="px-5 py-4 text-[11px] text-brand-300">DTMS v0.1 · MVP</div>
    </aside>
  );
}