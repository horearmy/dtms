'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
  ChevronDown,
  ChevronRight,
  Zap,
  TrendingUp,
  Radar,
  ClipboardList,
  ShieldAlert,
  Activity,
  Plug,
  CreditCard,
  Lock,
  MessageSquare,
  Network,
  Globe,
  Warehouse,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; icon: React.ReactNode; locked?: boolean; feature?: string };
type NavGroup = { title: string; items: NavItem[] };

type WhiteLabel = { appName: string | null; logoUrl: string | null; primaryColor: string | null } | null;

export default function Sidebar({ role, tenantPlan, planFeatures, whiteLabel, open, onClose }: { role: string; tenantPlan: string | null; planFeatures?: string[]; whiteLabel?: WhiteLabel; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [securityLevel, setSecurityLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const fetchSecurityStatus = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await fetch('/api/admin/security/status');
      if (res.ok) {
        const data = await res.json();
        setSecurityLevel(data.level);
      }
    } catch {}
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchSecurityStatus();
    if (!isSuperAdmin) return;
    const t = setInterval(fetchSecurityStatus, 60000);
    return () => clearInterval(t);
  }, [fetchSecurityStatus, isSuperAdmin]);

  const showUsers = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL'].includes(role);
  const showPremium = !isSuperAdmin && tenantPlan !== 'ENTERPRISE';
  const features = planFeatures || [];
  const isFreePlan = !isSuperAdmin && (!tenantPlan || tenantPlan === 'FREE');

  function hasFeature(featureCode: string) {
    if (isSuperAdmin) return true;
    return features.includes(featureCode);
  }

  const groups: NavGroup[] = isSuperAdmin
    ? [
        {
          title: 'TENANT MANAGEMENT',
          items: [
            { href: '/tenants', label: 'Tenants', icon: <Building2 size={18} /> },
            { href: '/hierarchy', label: 'Hierarchy', icon: <Network size={18} /> },
            { href: '/tenant-onboarding', label: 'Onboarding', icon: <ClipboardList size={18} /> },
            { href: '/tenant-health', label: 'Health Monitor', icon: <Activity size={18} /> },
            { href: '/demo-requests', label: 'Permohonan Demo', icon: <ClipboardList size={18} /> },
            { href: '/komunikasi', label: 'Komunikasi', icon: <MessageSquare size={18} /> },
            { href: '/global-control-tower', label: 'Global Control Tower', icon: <Activity size={18} /> },
          ],
        },
        {
          title: 'SYSTEM',
          items: [
            { href: '/security', label: 'Security', icon: <Shield size={18} /> },
            { href: '/roles', label: 'Roles & Permissions', icon: <Shield size={18} /> },
            { href: '/audit', label: 'Audit Log', icon: <Zap size={18} /> },
          ],
        },
      ]
    : [
        {
          title: 'DASHBOARD',
          items: [
            { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
            { href: '/control-tower', label: 'Control Tower', icon: <Activity size={18} />, locked: !hasFeature('control_tower'), feature: 'control_tower' },
          ],
        },
        {
          title: 'OPERATIONS',
          items: [
            { href: '/dispatch', label: 'Dispatch Board', icon: <Zap size={18} />, locked: !hasFeature('dispatch'), feature: 'dispatch' },
            { href: '/shipments', label: 'Pengiriman', icon: <Package size={18} /> },
            { href: '/tracking', label: 'Lacak Pengiriman', icon: <MapPin size={18} /> },
            { href: '/customers', label: 'Pelanggan', icon: <Users size={18} /> },
            { href: '/drivers', label: 'Kurir', icon: <Truck size={18} /> },
            { href: '/vehicles', label: 'Kendaraan', icon: <Car size={18} /> },
            { href: '/warehouses', label: 'Gudang', icon: <Warehouse size={18} /> },
            { href: '/map', label: 'Live Tracking Map', icon: <Radar size={18} /> },
          ],
        },
        {
          title: 'DATA & REPORTING',
          items: [
            { href: '/reports', label: 'Laporan', icon: <FileText size={18} />, locked: !hasFeature('reports'), feature: 'reports' },
            { href: '/analytics', label: 'Analitik', icon: <BarChart3 size={18} />, locked: !hasFeature('reports'), feature: 'reports' },
          ],
        },
        {
          title: 'SYSTEM',
          items: [
            ...(showUsers ? [{ href: '/users', label: 'Pengguna', icon: <Shield size={18} /> }] : []),
            ...(showUsers ? [{ href: '/organizations', label: 'Organizations', icon: <Network size={18} /> }] : []),
            ...(showUsers ? [{ href: '/regions', label: 'Regions', icon: <Globe size={18} /> }] : []),
            ...(showUsers ? [{ href: '/branches', label: 'Branches', icon: <Building size={18} /> }] : []),
            ...(showUsers ? [{ href: '/departments', label: 'Departemen', icon: <Building2 size={18} /> }] : []),
            ...(showUsers ? [{ href: '/hubs', label: 'Hub', icon: <MapPin size={18} /> }] : []),
            ...(showUsers ? [{ href: '/tenant-onboarding', label: 'Onboarding', icon: <ClipboardList size={18} /> }] : []),
            ...(showUsers ? [{ href: '/tenant-health', label: 'Health Monitor', icon: <Activity size={18} /> }] : []),
            { href: '/exceptions', label: 'Exceptions', icon: <ShieldAlert size={18} />, locked: !hasFeature('sla'), feature: 'sla' },
            { href: '/sla', label: 'SLA Policies', icon: <TrendingUp size={18} />, locked: !hasFeature('sla'), feature: 'sla' },
            { href: '/notifications', label: 'Notifikasi', icon: <Bell size={18} /> },
            { href: '/pesan', label: 'Pesan', icon: <MessageSquare size={18} /> },
            { href: '/integrations', label: 'Integrations', icon: <Plug size={18} />, locked: !hasFeature('integrations'), feature: 'integrations' },
            { href: '/settings/whatsapp', label: 'Pengaturan', icon: <Settings size={18} /> },
            ...(showUsers ? [{ href: '/settings/profile', label: 'Profil Perusahaan', icon: <Building2 size={18} /> }] : []),
            ...(showUsers ? [{ href: '/roles', label: 'Roles & Permissions', icon: <Shield size={18} /> }] : []),
            { href: '/audit', label: 'Audit Log', icon: <Zap size={18} /> },
            { href: '/billing', label: 'Billing', icon: <CreditCard size={18} /> },
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
          {whiteLabel?.logoUrl ? (
            <img src={whiteLabel.logoUrl} alt="Logo" className="h-10 w-10 rounded-xl object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: whiteLabel?.primaryColor || '#0D6EFD' }}>
              <Package size={20} className="text-white" />
            </div>
          )}
          <div>
            <div className="text-sm font-bold tracking-wide text-white">{whiteLabel?.appName || 'DTMS'}</div>
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
                      const href = item.locked ? `/billing?upgrade=${item.feature}` : item.href;
                      return (
                        <Link
                          key={item.href}
                          href={href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            active && !item.locked
                              ? 'bg-[#0D6EFD] text-white'
                              : item.locked
                                ? 'text-white/30 hover:bg-white/5 hover:text-white/50'
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          {item.icon}
                          <span className="flex-1">{item.label}</span>
                          {item.href === '/security' && securityLevel && (
                            <span className={`h-2 w-2 rounded-full ${
                              securityLevel === 'HIGH' ? 'bg-red-500 animate-pulse' :
                              securityLevel === 'MEDIUM' ? 'bg-amber-400' :
                              'bg-emerald-400'
                            }`} title={securityLevel === 'HIGH' ? 'Ancaman Tinggi' : securityLevel === 'MEDIUM' ? 'Ancaman Sedang' : 'Sistem Aman'} />
                          )}
                          {item.locked && <Lock size={12} className="text-white/30" />}
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
                <span className="text-xs font-semibold text-white">
                  {isFreePlan ? 'Upgrade Plan' : 'Premium Features'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/50 mb-3">
                {isFreePlan
                  ? 'Buka semua fitur dengan upgrade plan Anda'
                  : 'Akses lebih banyak fitur premium untuk bisnis Anda'}
              </p>
              <Link href="/billing" className="block w-full rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-center text-xs font-semibold text-white transition hover:bg-[#0B5FD5]">
                {isFreePlan ? 'Lihat Plan' : 'Upgrade Sekarang'}
              </Link>
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
