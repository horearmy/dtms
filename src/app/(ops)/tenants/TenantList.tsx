"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN_ORDER } from '@/lib/plan-constants';

type Tenant = {
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
  active: boolean;
  maxUsers: number;
  maxDrivers: number;
  maxShipments: number;
  createdAt: string;
  _count: { users: number; drivers: number; shipments: number };
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelledAt: string | null;
    plan: { code: string; name: string };
  } | null;
};

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    name: '', slug: '', code: '', status: 'ACTIVE',
    primaryColor: '#2563eb', secondaryColor: '#1e40af', accentColor: '#3b82f6',
    domain: '', plan: 'FREE', timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR',
    contactName: '', contactEmail: '', contactPhone: '',
    logoUrl: '', faviconUrl: '', appName: '',
    maxUsers: 5, maxDrivers: 10, maxShipments: 100,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState('');

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/tenants?status=${statusFilter}` : '/api/tenants';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTenants(Array.isArray(data) ? data : data.tenants || []);
      }
    } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  function openCreate() {
    setEditTenant(null);
    setForm({
      name: '', slug: '', code: '', status: 'ACTIVE',
      primaryColor: '#2563eb', secondaryColor: '#1e40af', accentColor: '#3b82f6',
      domain: '', plan: 'FREE', timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR',
      contactName: '', contactEmail: '', contactPhone: '',
      logoUrl: '', faviconUrl: '', appName: '',
      maxUsers: 5, maxDrivers: 10, maxShipments: 100,
    });
    setShowForm(true);
    setError('');
  }

  async function openEdit(t: Tenant) {
    setEditTenant(t);
    let appName = '';
    try {
      const wlRes = await fetch(`/api/tenants/${t.id}/white-label`);
      if (wlRes.ok) { const wl = await wlRes.json(); appName = wl.appName || ''; }
    } catch {}
    setForm({
      name: t.name, slug: t.slug, code: t.code || '', status: t.status,
      primaryColor: t.primaryColor, secondaryColor: t.secondaryColor, accentColor: t.accentColor,
      domain: t.domain || '', plan: t.plan, timezone: t.timezone, locale: t.locale, currency: t.currency,
      contactName: t.contactName || '', contactEmail: t.contactEmail || '', contactPhone: t.contactPhone || '',
      logoUrl: t.logoUrl || '', faviconUrl: t.faviconUrl || '', appName,
      maxUsers: t.maxUsers, maxDrivers: t.maxDrivers, maxShipments: t.maxShipments,
    });
    setShowForm(true);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const url = editTenant ? `/api/tenants/${editTenant.id}` : '/api/tenants';
    const method = editTenant ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, slug: form.slug, code: form.code || null, status: form.status,
          primaryColor: form.primaryColor, secondaryColor: form.secondaryColor, accentColor: form.accentColor,
          domain: form.domain || null, plan: form.plan, timezone: form.timezone, locale: form.locale, currency: form.currency,
          contactName: form.contactName || null, contactEmail: form.contactEmail || null, contactPhone: form.contactPhone || null,
          logoUrl: form.logoUrl || null, faviconUrl: form.faviconUrl || null,
          maxUsers: form.maxUsers, maxDrivers: form.maxDrivers, maxShipments: form.maxShipments,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); setSaving(false); return; }
      if (editTenant && form.appName !== undefined) {
        try {
          await fetch(`/api/tenants/${editTenant.id}/white-label`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName: form.appName || null }),
          });
        } catch {}
      }
      setSaving(false);
      setShowForm(false);
      fetchTenants();
    } catch {
      setError('Terjadi kesalahan');
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    fetchTenants();
  }

  async function archiveTenant(id: string, name: string) {
    setConfirmDelete(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      if (res.ok) {
        setSuccess(`Tenant "${name}" berhasil diarsipkan.`);
        fetchTenants();
      }
    } catch {}
    setDeleting(false);
  }

  async function deleteTenant(id: string, name: string) {
    setConfirmDelete(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      if (res.ok) {
        setSuccess(`Tenant "${name}" dan semua data terkait berhasil dihapus permanen.`);
        fetchTenants();
      }
    } catch {}
    setDeleting(false);
  }

  const planBadge = (plan: string) => {
    const c: Record<string, string> = {
      FREE: 'bg-[#F7F9FC] text-[#667085]', STARTER: 'bg-[#0D6EFD]/10 text-[#0D6EFD]',
      PRO: 'bg-purple-100 text-purple-700', ENTERPRISE: 'bg-amber-100 text-amber-700',
    };
    return c[plan] || c.FREE;
  };

  const statusBadge = (s: string) => {
    const c: Record<string, string> = {
      ACTIVE: 'bg-emerald-100 text-emerald-700', SUSPENDED: 'bg-amber-100 text-amber-700',
      INACTIVE: 'bg-gray-100 text-gray-600', PENDING_APPROVAL: 'bg-blue-100 text-blue-700',
      ARCHIVED: 'bg-gray-200 text-gray-500',
    };
    return c[s] || c.ACTIVE;
  };

  return (
    <div>
      {success && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-3 text-emerald-500 hover:text-emerald-700">&times;</button>
        </div>
      )}
      <div className="mb-4 flex items-center gap-3 justify-end">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
          <option value="">Semua Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="ARCHIVED">Diarsipkan</option>
        </select>
        <button onClick={openCreate} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5]">
          + Tenant Baru
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="mb-4 text-lg font-bold text-[#101828]">{editTenant ? 'Edit Tenant' : 'Tenant Baru'}</h2>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Nama *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Slug *</label>
                  <input type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    disabled={!!editTenant}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none disabled:bg-[#F7F9FC]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Kode</label>
                  <input type="text" maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="DTMS"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING_APPROVAL">Pending</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Plan</label>
                  <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="FREE">Free</option>
                    <option value="STARTER">Starter</option>
                    <option value="GROWTH">Growth</option>
                    <option value="PRO">Professional</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                  {editTenant && PLAN_ORDER.indexOf(form.plan) < PLAN_ORDER.indexOf(editTenant.plan) && (
                    <p className={`mt-1 text-[11px] leading-tight ${(() => {
                      const sub = editTenant.subscription;
                      const active = sub?.status === 'ACTIVE' && sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date();
                      return active ? 'text-[#F5222D]' : 'text-[#667085]';
                    })()}`}>
                      {(() => {
                        const sub = editTenant.subscription;
                        const active = sub?.status === 'ACTIVE' && sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date();
                        return active
                          ? `Masa langganan aktif s/d ${new Date(sub!.currentPeriodEnd).toLocaleDateString('id-ID')} — downgrade akan ditolak.`
                          : 'Perhatian: ini penurunan paket, kuota langsung dikurangi.';
                      })()}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Timezone</label>
                  <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                    <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                    <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Mata Uang</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                    <option value="SGD">SGD</option>
                    <option value="MYR">MYR</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Domain</label>
                  <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    placeholder="logistik.example.com"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Locale</label>
                  <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="id-ID">Indonesia (id-ID)</option>
                    <option value="en-US">English (en-US)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Nama Header (Aplikasi)</label>
                  <input type="text" value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })}
                    placeholder="DTMS"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Logo URL</label>
                  <input type="text" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Favicon URL</label>
                  <input type="text" value={form.faviconUrl} onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
                    placeholder="https://example.com/favicon.ico"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Kontak Nama</label>
                  <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Kontak Email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    placeholder="admin@example.com"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Kontak Telepon</label>
                  <input type="text" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Warna Primer</label>
                  <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-[#E4E7EC]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Warna Sekunder</label>
                  <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-[#E4E7EC]" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Warna Aksen</label>
                  <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-[#E4E7EC]" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Max Users</label>
                  <input type="number" min={1} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: +e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Max Drivers</label>
                  <input type="number" min={1} value={form.maxDrivers} onChange={(e) => setForm({ ...form, maxDrivers: +e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#667085]">Max Kiriman/bulan</label>
                  <input type="number" min={1} value={form.maxShipments} onChange={(e) => setForm({ ...form, maxShipments: +e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-medium text-[#667085] hover:bg-[#F7F9FC]">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Lokasi</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#667085]">Memuat...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#667085]">Belum ada tenant</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                <td className="px-4 py-3">
                  <Link href={`/tenants/${t.id}`} className="block hover:opacity-80">
                    <div className="font-semibold text-[#0D6EFD] hover:underline">{t.name}</div>
                    <div className="text-xs text-[#667085]">{t.code ? `${t.code} · ` : ''}{t.slug}{t.domain ? ` · ${t.domain}` : ''}</div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${planBadge(t.plan)}`}>{t.plan}</span>
                    {t.subscription && (
                      <span className="text-[10px] text-[#667085]">
                        {t.subscription.billingCycle === 'YEARLY' ? 'Tahunan' : 'Bulanan'}
                        {t.subscription.status === 'CANCELLED' && <span className="text-red-500"> · Dibatalkan</span>}
                        {t.subscription.status === 'ACTIVE' && t.subscription.currentPeriodEnd && (
                          <span> · s/d {new Date(t.subscription.currentPeriodEnd).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(t.id, t.active)}
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(t.status)}`}>
                    {t.status}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-[#667085]">
                  {t.timezone?.replace('Asia/', '')} · {t.currency}
                </td>
                <td className="px-4 py-3 text-xs text-[#667085]">
                  {t._count.users}/{t.maxUsers} user · {t._count.shipments}/{t.maxShipments} kiriman
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(t)} className="text-xs font-medium text-[#0D6EFD] hover:underline">Edit</button>
                    <button onClick={() => setConfirmDelete({ id: t.id, name: t.name })} disabled={deleting} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="mb-2 text-lg font-bold text-[#101828]">Kelola Tenant</h2>
            <p className="mb-1 text-sm text-[#667085]">Pilih aksi untuk tenant <b>{confirmDelete.name}</b>:</p>
            <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Arsipkan akan menonaktifkan tenant tanpa menghapus data. Tenant dapat diaktifkan kembali.
            </div>
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              Hapus permanen akan menghapus tenant dan <b>SEMUA data terkirim, user, driver, kendaraan</b>. Tidak dapat dibatalkan.
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-medium text-[#667085] hover:bg-[#F7F9FC] disabled:opacity-50">
                Batal
              </button>
              <button onClick={() => archiveTenant(confirmDelete.id, confirmDelete.name)} disabled={deleting}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                {deleting ? 'Memproses...' : 'Arsipkan'}
              </button>
              <button onClick={() => deleteTenant(confirmDelete.id, confirmDelete.name)} disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Memproses...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
