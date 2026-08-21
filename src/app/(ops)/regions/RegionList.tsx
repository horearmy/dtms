"use client";

import { useEffect, useState } from 'react';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';

type Region = {
  id: string;
  tenantId: string;
  organizationId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  createdAt: string;
  organization: { id: string; name: string; code: string | null } | null;
  _count: { branches: number };
};

type Org = { id: string; name: string; code: string | null };

export default function RegionList() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRegion, setEditRegion] = useState<Region | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', organizationId: '', latitude: '', longitude: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => { Promise.all([fetchRegions(), fetchOrgs()]).then(() => setLoading(false)); }, []);

  async function fetchRegions() {
    try {
      const res = await fetch('/api/regions');
      if (res.ok) setRegions(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchOrgs() {
    try {
      const res = await fetch('/api/organizations');
      if (res.ok) setOrgs(await res.json());
    } catch { /* ignore */ }
  }

  function openCreate() {
    setEditRegion(null);
    setForm({ name: '', code: '', description: '', organizationId: '', latitude: '', longitude: '' });
    setShowForm(true);
    setError('');
  }

  function openEdit(r: Region) {
    setEditRegion(r);
    setForm({
      name: r.name, code: r.code || '', description: r.description || '',
      organizationId: r.organizationId || '', latitude: r.latitude?.toString() || '', longitude: r.longitude?.toString() || '',
    });
    setShowForm(true);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const url = editRegion ? `/api/regions/${editRegion.id}` : '/api/regions';
    const method = editRegion ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, code: form.code || null, description: form.description || null,
          organizationId: form.organizationId || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); setSaving(false); return; }
      setShowForm(false);
      setSuccess(editRegion ? 'Region berhasil diupdate' : 'Region berhasil dibuat');
      fetchRegions();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Terjadi kesalahan'); }
    setSaving(false);
  }

  async function deleteRegion(id: string) {
    try {
      const res = await fetch(`/api/regions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menghapus'); return; }
      fetchRegions();
    } catch { alert('Terjadi kesalahan'); }
  }

  if (loading) return <div className="text-sm text-[#667085] py-8">Memuat data...</div>;

  return (
    <div>
      {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]">
          + Buat Region
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{editRegion ? 'Edit Region' : 'Buat Region'}</h3>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama *</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kode</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Organization</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })}>
                    <option value="">-- Tidak Terikat --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi</label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Lokasi Region</label>
                <LocationPicker
                  value={{ lat: form.latitude ? Number(form.latitude) : null, lng: form.longitude ? Number(form.longitude) : null, address: '', city: '', postalCode: '' }}
                  onChange={(loc: PickedLocation) => setForm({ ...form, latitude: loc.lat?.toString() || '', longitude: loc.lng?.toString() || '' })}
                  mapHeight="h-64"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8] disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {regions.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          Belum ada region. Klik &ldquo;Buat Region&rdquo; untuk menambah.
        </div>
      ) : (
        <div className="rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Branches</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {regions.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-[#101828]">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#667085]">{r.code || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{r.organization?.name || '-'}</td>
                  <td className="px-4 py-3">{r._count.branches}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(r)} className="text-xs text-[#2563eb] hover:underline">Edit</button>
                      <button onClick={() => { if (confirm(`Hapus region "${r.name}"?`)) deleteRegion(r.id); }} className="text-xs text-red-600 hover:underline">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
