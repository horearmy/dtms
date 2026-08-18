"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type TenantData = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string | null;
  plan: string;
  status: string;
  timezone: string;
  locale: string;
  currency: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  maxUsers: number;
  maxDrivers: number;
  maxShipments: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; drivers: number; shipments: number; vehicles: number; customers: number; geofences: number };
  users: { id: string; name: string; username: string; role: string; status: string; email: string | null; createdAt: string }[];
  drivers: { id: string; employeeId: string; name: string; phone: string; status: string }[];
  shipments: { id: string; trackingNumber: string; origin: string; destination: string; status: string; serviceType: string; weight: number; createdAt: string }[];
  vehicles: { id: string; vehicleNumber: string; type: string; status: string; capacity: number }[];
  shipmentStats: { total: number; delivered: number; intransit: number };
};

const STATUS_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Dibuat', PICKUP_SCHEDULED: 'Jemput', PICKED_UP: 'Dijemput',
  WAREHOUSE_RECEIVED: 'Diterima Gudang', SORTING: 'Sorting', DISPATCHED: 'Dikirim',
  IN_TRANSIT: 'Dalam Perjalanan', ARRIVED_AT_HUB: 'Tiba di Hub', OUT_FOR_DELIVERY: 'Diantar',
  DELIVERED: 'Terkirim', DELIVERY_FAILED: 'Gagal', RESCHEDULED: 'Dijadwal Ulang',
  RETURN_TO_SENDER: 'Retur', RETURNED: 'Dikembalikan',
};

const STATUS_COLORS: Record<string, string> = {
  DELIVERED: 'bg-green-100 text-green-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  ARRIVED_AT_HUB: 'bg-purple-100 text-purple-700',
  DISPATCHED: 'bg-cyan-100 text-cyan-700',
  DELIVERY_FAILED: 'bg-red-100 text-red-700',
  RETURNED: 'bg-orange-100 text-orange-700',
  WAREHOUSE_RECEIVED: 'bg-yellow-100 text-yellow-700',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN_OPERASIONAL: 'Admin Ops', DISPATCHER: 'Dispatcher',
  WAREHOUSE: 'Gudang', DRIVER: 'Driver', CUSTOMER_SERVICE: 'CS', SUPERVISOR: 'Supervisor',
  MANAGEMENT: 'Manajemen', CUSTOMER: 'Pelanggan',
};

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-[#F7F9FC] text-[#667085]', STARTER: 'bg-[#0D6EFD]/10 text-[#0D6EFD]',
  BUSINESS: 'bg-purple-100 text-purple-700', ENTERPRISE: 'bg-amber-100 text-amber-700',
};

const TENANT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700', SUSPENDED: 'bg-amber-100 text-amber-700',
  INACTIVE: 'bg-gray-100 text-gray-600', PENDING: 'bg-blue-100 text-blue-700',
};

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-[#0D6EFD]';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[#667085]">{label}</span>
        <span className="font-medium text-[#101828]">{used} / {max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F7F9FC]">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TenantDetail({ tenant }: { tenant: TenantData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'drivers' | 'shipments' | 'vehicles'>('overview');

  async function toggleActive() {
    await fetch(`/api/tenants/${tenant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !tenant.active }),
    });
    router.refresh();
  }

  const tabs = [
    { key: 'overview', label: 'Ringkasan' },
    { key: 'users', label: `Users (${tenant._count.users})` },
    { key: 'drivers', label: `Drivers (${tenant._count.drivers})` },
    { key: 'shipments', label: `Shipments (${tenant._count.shipments})` },
    { key: 'vehicles', label: `Vehicles (${tenant._count.vehicles})` },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants" className="rounded-lg border border-[#E4E7EC] p-2 text-[#667085] hover:bg-[#F7F9FC]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#101828]">{tenant.name}</h1>
          <p className="text-sm text-[#667085]">{tenant.code ? `${tenant.code} · ` : ''}{tenant.slug}{tenant.domain ? ` · ${tenant.domain}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleActive}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tenant.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
            {tenant.active ? 'Aktif' : 'Nonaktif'}
          </button>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TENANT_STATUS_COLORS[tenant.status] || TENANT_STATUS_COLORS.ACTIVE}`}>
            {tenant.status}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PLAN_COLORS[tenant.plan] || PLAN_COLORS.FREE}`}>
            {tenant.plan}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#667085]">Branding:</span>
          <span className="h-6 w-6 rounded-lg border border-[#E4E7EC]" style={{ backgroundColor: tenant.primaryColor }} title="Primary" />
          <span className="h-6 w-6 rounded-lg border border-[#E4E7EC]" style={{ backgroundColor: tenant.secondaryColor }} title="Secondary" />
          <span className="h-6 w-6 rounded-lg border border-[#E4E7EC]" style={{ backgroundColor: tenant.accentColor }} title="Accent" />
        </div>
        <div className="h-6 w-px bg-[#E4E7EC]" />
        <div className="text-xs text-[#667085]">
          Timezone: <span className="font-medium text-[#101828]">{tenant.timezone?.replace('Asia/', '')}</span>
        </div>
        <div className="h-6 w-px bg-[#E4E7EC]" />
        <div className="text-xs text-[#667085]">
          Locale: <span className="font-medium text-[#101828]">{tenant.locale}</span> · <span className="font-medium text-[#101828]">{tenant.currency}</span>
        </div>
        <div className="h-6 w-px bg-[#E4E7EC]" />
        <div className="text-xs text-[#667085]">
          Dibuat: <span className="font-medium text-[#101828]">{new Date(tenant.createdAt).toLocaleDateString('id-ID')}</span>
        </div>
        {tenant.contactName && (
          <>
            <div className="h-6 w-px bg-[#E4E7EC]" />
            <div className="text-xs text-[#667085]">
              Kontak: <span className="font-medium text-[#101828]">{tenant.contactName}</span>
              {tenant.contactEmail && <span className="text-[#667085]"> · {tenant.contactEmail}</span>}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Total Users</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{tenant._count.users}</div>
          <div className="mt-3"><UsageBar used={tenant._count.users} max={tenant.maxUsers} label="Kuota" /></div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Total Drivers</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{tenant._count.drivers}</div>
          <div className="mt-3"><UsageBar used={tenant._count.drivers} max={tenant.maxDrivers} label="Kuota" /></div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Total Shipments</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{tenant._count.shipments}</div>
          <div className="mt-3"><UsageBar used={tenant._count.shipments} max={tenant.maxShipments} label="Kuota/bulan" /></div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Vehicles</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{tenant._count.vehicles}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Customers</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{tenant._count.customers}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Geofences</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{tenant._count.geofences}</div>
        </div>
      </div>

      {tenant.shipmentStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="text-xs text-[#667085]">Total Kiriman</div>
            <div className="mt-1 text-2xl font-bold text-[#101828]">{tenant.shipmentStats.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="text-xs text-emerald-600">Terkirim</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{tenant.shipmentStats.delivered}</div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
            <div className="text-xs text-blue-600">Dalam Perjalanan</div>
            <div className="mt-1 text-2xl font-bold text-blue-700">{tenant.shipmentStats.intransit}</div>
          </div>
        </div>
      )}

      <div className="border-b border-[#E4E7EC]">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-[#0D6EFD] text-[#0D6EFD]'
                  : 'border-transparent text-[#667085] hover:text-[#101828]'
              }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'users' && (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {tenant.users.map((u) => (
                <tr key={u.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-medium text-[#101828]">{u.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{u.username}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#F7F9FC] px-2 py-0.5 text-xs font-medium text-[#667085]">{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {u.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{u.email || '-'}</td>
                </tr>
              ))}
              {tenant.users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[#667085]">Belum ada user</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">ID Karyawan</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenant.drivers.map((d) => (
                <tr key={d.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-medium text-[#101828]">{d.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{d.employeeId}</td>
                  <td className="px-4 py-3 text-[#667085]">{d.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {d.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                </tr>
              ))}
              {tenant.drivers.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[#667085]">Belum ada driver</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'shipments' && (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">No. Resi</th>
                <th className="px-4 py-3">Asal</th>
                <th className="px-4 py-3">Tujuan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Berat</th>
                <th className="px-4 py-3">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {tenant.shipments.map((s) => (
                <tr key={s.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-medium text-[#0D6EFD]">{s.trackingNumber}</td>
                  <td className="px-4 py-3 text-[#667085]">{s.origin}</td>
                  <td className="px-4 py-3 text-[#667085]">{s.destination}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s.status] || 'bg-[#F7F9FC] text-[#667085]'}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{s.weight} kg</td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{new Date(s.createdAt).toLocaleDateString('id-ID')}</td>
                </tr>
              ))}
              {tenant.shipments.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#667085]">Belum ada shipment</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nomor Kendaraan</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Kapasitas</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenant.vehicles.map((v) => (
                <tr key={v.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-medium text-[#101828]">{v.vehicleNumber}</td>
                  <td className="px-4 py-3 text-[#667085]">{v.type}</td>
                  <td className="px-4 py-3 text-[#667085]">{v.capacity} kg</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' :
                      v.status === 'IN_USE' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
              {tenant.vehicles.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[#667085]">Belum ada kendaraan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
