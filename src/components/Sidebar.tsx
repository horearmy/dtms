'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  MapPin,
  Users,
  Truck,
  Car,
  BarChart3,
  Settings,
  Bell,
  Shield,
  FileText,
  Building2,
  Warehouse,
  ChevronDown,
  ChevronRight,
  Zap,
  TrendingUp,
  Download,
  MessageSquare,
  Radar,
  ClipboardList,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavGroup = { title: string; items: NavItem[] };

export default function Sidebar({ role, tenantPlan, open, onClose }: { role: string; tenantPlan: string | null; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const showUsers = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(role);
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const showPremium = !isSuperAdmin && tenantPlan !== 'PREMIUM';

  const groups: NavGroup[] = isSuperAdmin
    ? [
        {
          title: 'TENANT MANAGEMENT',
          items: [
            { href: '/tenants', label: 'Tenants', icon: <Building2 size={18} /> },
            { href: '/demo-requests', label: 'Permohonan Demo', icon: <ClipboardList size={18} /> },
          ],
        },
        {
          title: 'SYSTEM',
          items: [
            { href: '/audit', label: 'Audit Log', icon: <Zap size={18} /> },
          ],
        },
      ]
    : [
        {
          title: 'DASHBOARD',
          items: [
            { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
            { href: '/control-tower', label: 'Control Tower', icon: <Activity size={18} /> },
          ],
        },
        {
          title: 'OPERATIONS',
          items: [
            { href: '/orders', label: 'Orders', icon: <ClipboardList size={18} /> },
            { href: '/dispatch', label: 'Dispatch Board', icon: <Zap size={18} /> },
            { href: '/shipments', label: 'Pengiriman', icon: <Package size={18} /> },
            { href: '/tracking', label: 'Lacak Pengiriman', icon: <MapPin size={18} /> },
            { href: '/customers', label: 'Pelanggan', icon: <Users size={18} /> },
            { href: '/drivers', label: 'Kurir', icon: <Truck size={18} /> },
            { href: '/vehicles', label: 'Kendaraan', icon: <Car size={18} /> },
            { href: '/map', label: 'Live Tracking Map', icon: <Radar size={18} /> },
          ],
        },
        {
          title: 'DATA & REPORTING',
          items: [
            { href: '/reports', label: 'Laporan', icon: <FileText size={18} /> },
            { href: '/analytics', label: 'Analitik', icon: <BarChart3 size={18} /> },
          ],
        },
        {
          title: 'SYSTEM',
          items: [
            { href: '/exceptions', label: 'Exceptions', icon: <ShieldAlert size={18} /> },
            { href: '/sla', label: 'SLA Policies', icon: <TrendingUp size={18} /> },
            { href: '/notifications', label: 'Notifikasi', icon: <Bell size={18} /> },
            { href: '/settings/whatsapp', label: 'Pengaturan', icon: <Settings size={18} /> },
            ...(showUsers ? [{ href: '/users', label: 'Pengguna', icon: <Shield size={18} /> }] : []),
            { href: '/audit', label: 'Audit Log', icon: <Zap size={18} /> },
          ],
        },
      ];

  function toggleGroup(title: string) {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col bg-[#061B41] transition-transform duration-200 lg:flex lg:translate-x-0',
          open ? 'flex' : 'hidden -translate-x-full lg:flex'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D6EFD]">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide text-white">DTMS</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/50">
              Delivery Management System
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {groups.map((group) => (
            <div key={group.title} className="mb-4">
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 hover:text-white/60"
              >
                {group.title}
                {collapsed[group.title] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
              {!collapsed[group.title] && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-[#0D6EFD] text-white'
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Premium Card */}
        {showPremium && (
          <div className="mx-3 mb-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-[#0D6EFD]" />
                <span className="text-xs font-semibold text-white">Premium</span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/50 mb-3">
                Tingkatkan pengalaman Anda dengan fitur premium
              </p>
              <button className="w-full rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0B5FD5]">
                Upgrade Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/5 px-5 py-3">
          <div className="text-[11px] font-medium text-white/30">DTMS v2.0.0</div>
          <div className="text-[10px] text-white/20">© 2026 All rights reserved.</div>
        </div>
      </aside>
    </>
  );
}
