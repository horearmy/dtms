"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string | null;
  plan: string;
  active: boolean;
  maxUsers: number;
  maxDrivers: number;
  maxShipments: number;
  createdAt: string;
  _count: { users: number; drivers: number; shipments: number };
};

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState({
    name: '', slug: '', primaryColor: '#2563eb', secondaryColor: '#1e40af', accentColor: '#3b82f6',
    domain: '', plan: 'FREE', contactName: '', contactEmail: '', contactPhone: '',
    maxUsers: 5, maxDrivers: 10, maxShipments: 100,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  async function fetchTenants() {
    setLoading(true);
    const res = await fetch('/api/tenants');
    if (res.ok) setTenants(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setEditTenant(null);
    setForm({
      name: '', slug: '', primaryColor: '#2563eb', secondaryColor: '#1e40af', accentColor: '#3b82f6',
      domain: '', plan: 'FREE', contactName: '', contactEmail: '', contactPhone: '',
      maxUsers: 5, maxDrivers: 10, maxShipments: 100,
    });
    setShowForm(true);
    setError('');
  }

  function openEdit(t: Tenant) {
    setEditTenant(t);
    setForm({
      name: t.name, slug: t.slug, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor,
      accentColor: t.accentColor, domain: t.domain || '', plan: t.plan,
      contactName: '', contactEmail: '', contactPhone: '',
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
          ...form,
          domain: form.domain || null,
          contactName: form.contactName || null,
          contactEmail: form.contactEmail || null,
          contactPhone: form.contactPhone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan');
        setSaving(false);
        return;
      }
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

  async function remove(id: string) {
    if (!confirm('Yakin hapus tenant ini?')) return;
    await fetch(`/api/tenants/${id}`, { method: 'DELETE' });
    fetchTenants();
  }

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      FREE: 'bg-gray-100 text-gray-700',
      STARTER: 'bg-blue-100 text-blue-700',
      BUSINESS: 'bg-purple-100 text-purple-700',
      ENTERPRISE: 'bg-amber-100 text-amber-700',
    };
    return colors[plan] || colors.FREE;
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          + Tenant Baru
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-900">{editTenant ? 'Edit Tenant' : 'Tenant Baru'}</h2>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nama Perusahaan *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Slug *</label>
                  <input type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    disabled={!!editTenant}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-50" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Warna Primer</label>
                  <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-gray-300" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Warna Sekunder</label>
                  <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-gray-300" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Warna Aksen</label>
                  <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-gray-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Domain</label>
                  <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    placeholder="logistik.example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Plan</label>
                  <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    <option value="FREE">Free</option>
                    <option value="STARTER">Starter</option>
                    <option value="BUSINESS">Business</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Max Users</label>
                  <input type="number" min={1} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: +e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Max Drivers</label>
                  <input type="number" min={1} value={form.maxDrivers} onChange={(e) => setForm({ ...form, maxDrivers: +e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Max Shipments/bln</label>
                  <input type="number" min={1} value={form.maxShipments} onChange={(e) => setForm({ ...form, maxShipments: +e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
              </div>
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Tenant</th>
              <th className="px-4 py-3 font-medium text-gray-600">Plan</th>
              <th className="px-4 py-3 font-medium text-gray-600">Branding</th>
              <th className="px-4 py-3 font-medium text-gray-600">Usage</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Belum ada tenant</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/tenants/${t.id}`} className="block hover:opacity-80">
                    <div className="font-semibold text-brand-600 hover:underline">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.slug}{t.domain ? ` · ${t.domain}` : ''}</div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${planBadge(t.plan)}`}>{t.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded" style={{ backgroundColor: t.primaryColor }} />
                    <span className="h-4 w-4 rounded" style={{ backgroundColor: t.secondaryColor }} />
                    <span className="h-4 w-4 rounded" style={{ backgroundColor: t.accentColor }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {t._count.users}/{t.maxUsers} user · {t._count.shipments}/{t.maxShipments} kiriman
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(t.id, t.active)}
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(t)} className="text-xs font-medium text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => remove(t.id)} className="text-xs font-medium text-red-600 hover:underline">Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
