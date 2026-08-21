"use client";

import { useEffect, useState } from 'react';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';

type Hub = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  active: boolean;
  branch: { id: string; name: string };
  createdAt: string;
};

type Branch = { id: string; name: string };

export default function HubList() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editHub, setEditHub] = useState<Hub | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', branchId: '', latitude: '', longitude: '', radiusMeters: '500' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showMap, setShowMap] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [hubRes, branchRes] = await Promise.all([
        fetch('/api/hubs'),
        fetch('/api/branches'),
      ]);
      if (hubRes.ok) setHubs(await hubRes.json());
      if (branchRes.ok) setBranches(await branchRes.json());
    } catch {}
    setLoading(false);
  }

  async function searchHubs(q: string) {
    if (!q) return fetchData();
    try {
      const res = await fetch(`/api/hubs?q=${encodeURIComponent(q)}`);
      if (res.ok) setHubs(await res.json());
    } catch {}
  }

  function openCreate() {
    setEditHub(null);
    setForm({ name: '', code: '', address: '', city: '', branchId: '', latitude: '', longitude: '', radiusMeters: '500' });
    setShowForm(true);
    setError('');
  }

  function openEdit(h: Hub) {
    setEditHub(h);
    setForm({
      name: h.name, code: h.code || '', address: h.address || '', city: h.city || '',
      branchId: h.branch?.id || '', latitude: h.latitude?.toString() || '',
      longitude: h.longitude?.toString() || '', radiusMeters: h.radiusMeters.toString(),
    });
    setShowForm(true);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const url = editHub ? `/api/hubs/${editHub.id}` : '/api/hubs';
    const method = editHub ? 'PUT' : 'POST';
    const body: Record<string, unknown> = {
      name: form.name, code: form.code || null, address: form.address || null,
      city: form.city || null, branchId: form.branchId || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      radiusMeters: Number(form.radiusMeters) || 500,
    };
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); setSaving(false); return; }
      setShowForm(false);
      setSuccess(editHub ? 'Hub berhasil diupdate' : 'Hub berhasil dibuat');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Terjadi kesalahan'); }
    setSaving(false);
  }

  async function deleteHub(id: string) {
    try {
      const res = await fetch(`/api/hubs/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menghapus'); return; }
      fetchData();
    } catch { alert('Terjadi kesalahan'); }
  }

  if (loading) return <div className="text-sm text-[#667085] py-8">Memuat data...</div>;

  return (
    <div>
      {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm placeholder:text-[#667085]"
          placeholder="Cari hub..."
          value={search}
          onChange={e => { setSearch(e.target.value); searchHubs(e.target.value); }}
        />
        <button onClick={openCreate} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] whitespace-nowrap">
          + Buat Hub
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">{editHub ? 'Edit Hub' : 'Buat Hub'}</h3>
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Branch *</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} required>
                    <option value="">Pilih Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Alamat</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kota</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Radius (m)</label>
                  <input type="number" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.radiusMeters} onChange={e => setForm({ ...form, radiusMeters: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Latitude</label>
                  <input type="number" step="any" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="-6.2088" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Longitude</label>
                  <input type="number" step="any" className="w-full rounded-lg border px-3 py-2 text-sm" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="106.8456" />
                </div>
              </div>
              <button type="button" onClick={() => setShowMap(!showMap)} className="text-xs text-[#2563eb] hover:underline">
                {showMap ? 'Tutup Peta' : 'Pilih dari Peta'}
              </button>
              {showMap && (
                <div className="h-[300px] rounded-lg overflow-hidden border">
                  <LocationPicker
                    value={{ lat: form.latitude ? Number(form.latitude) : null, lng: form.longitude ? Number(form.longitude) : null, address: form.address, city: form.city, postalCode: '' }}
                    onChange={(loc: PickedLocation) => setForm({ ...form, latitude: loc.lat?.toString() || '', longitude: loc.lng?.toString() || '', address: loc.address || form.address, city: loc.city || form.city })}
                  />
                </div>
              )}
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

      {hubs.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          Belum ada hub. Klik &ldquo;Buat Hub&rdquo; untuk menambah.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F7F9FC] text-xs uppercase text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Kota</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {hubs.map(h => (
                <tr key={h.id} className="hover:bg-[#F7F9FC]">
                  <td className="px-4 py-3 font-medium text-[#101828]">{h.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#667085]">{h.code || '—'}</td>
                  <td className="px-4 py-3 text-[#667085]">{h.branch?.name || '—'}</td>
                  <td className="px-4 py-3 text-[#667085]">{h.city || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {h.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(h)} className="mr-2 rounded-lg border px-3 py-1 text-xs hover:bg-gray-50">Edit</button>
                    <button onClick={() => { if (confirm(`Hapus "${h.name}"?`)) deleteHub(h.id); }} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Hapus</button>
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
