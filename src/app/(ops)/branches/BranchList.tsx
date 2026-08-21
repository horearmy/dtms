"use client";

import { useEffect, useState } from 'react';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';

type Branch = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  organization: { id: string; name: string } | null;
  region: { id: string; name: string } | null;
  _count: { users: number; warehouses: number; hubs: number };
};

type Org = { id: string; name: string };
type Region = { id: string; name: string };

export default function BranchList() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', postalCode: '', phone: '', organizationId: '', regionId: '', latitude: '', longitude: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [detailBranch, setDetailBranch] = useState<Branch | null>(null);

  useEffect(() => { Promise.all([fetchBranches(), fetchOrgs(), fetchRegions()]).then(() => setLoading(false)); }, []);

  async function fetchBranches(q?: string) {
    try {
      const url = q ? `/api/branches?q=${encodeURIComponent(q)}` : '/api/branches';
      const res = await fetch(url);
      if (res.ok) setBranches(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchOrgs() {
    try { const res = await fetch('/api/organizations'); if (res.ok) setOrgs(await res.json()); } catch {}
  }

  async function fetchRegions() {
    try { const res = await fetch('/api/regions'); if (res.ok) setRegions(await res.json()); } catch {}
  }

  function openCreate() {
    setEditBranch(null);
    setForm({ name: '', code: '', address: '', city: '', postalCode: '', phone: '', organizationId: '', regionId: '', latitude: '', longitude: '' });
    setShowForm(true);
    setError('');
  }

  function openEdit(b: Branch) {
    setEditBranch(b);
    setForm({
      name: b.name, code: b.code || '', address: b.address || '', city: b.city || '',
      postalCode: '', phone: b.phone || '', organizationId: b.organization?.id || '',
      regionId: b.region?.id || '', latitude: b.latitude?.toString() || '', longitude: b.longitude?.toString() || '',
    });
    setShowForm(true);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const url = editBranch ? `/api/branches/${editBranch.id}` : '/api/branches';
    const method = editBranch ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, code: form.code || null, address: form.address || null,
          city: form.city || null, postalCode: form.postalCode || null, phone: form.phone || null,
          organizationId: form.organizationId || null, regionId: form.regionId || null,
          latitude: form.latitude ? Number(form.latitude) : null,
          longitude: form.longitude ? Number(form.longitude) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); setSaving(false); return; }
      setShowForm(false);
      setSuccess(editBranch ? 'Branch berhasil diupdate' : 'Branch berhasil dibuat');
      fetchBranches();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Terjadi kesalahan'); }
    setSaving(false);
  }

  async function deleteBranch(id: string) {
    try {
      const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menghapus'); return; }
      fetchBranches();
    } catch { alert('Terjadi kesalahan'); }
  }

  async function viewDetail(id: string) {
    try {
      const res = await fetch(`/api/branches/${id}`);
      if (res.ok) setDetailBranch(await res.json());
    } catch { /* ignore */ }
  }

  if (loading) return <div className="text-sm text-[#667085] py-8">Memuat data...</div>;

  return (
    <div>
      {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex items-center gap-3">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); fetchBranches(e.target.value); }}
          placeholder="Cari branch..."
          className="flex-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
        />
        <button onClick={openCreate} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]">
          + Buat Branch
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{editBranch ? 'Edit Branch' : 'Buat Branch'}</h3>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nama *</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kode</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="BR001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Organization</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })}>
                    <option value="">-- Tidak Terikat --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Region</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.regionId} onChange={e => setForm({ ...form, regionId: e.target.value })}>
                    <option value="">-- Tidak Terikat --</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Alamat</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kota</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Kode Pos</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Telepon</label>
                  <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Lokasi Branch</label>
                <LocationPicker
                  value={{ lat: form.latitude ? Number(form.latitude) : null, lng: form.longitude ? Number(form.longitude) : null, address: '', city: '', postalCode: '' }}
                  onChange={(loc: PickedLocation) => setForm({ ...form, latitude: loc.lat?.toString() || '', longitude: loc.lng?.toString() || '' })}
                  mapHeight="h-56"
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

      {detailBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{detailBranch.name}</h3>
                {detailBranch.code && <p className="text-xs font-mono text-[#667085]">{detailBranch.code}</p>}
              </div>
              <button onClick={() => setDetailBranch(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {detailBranch.organization && <div><span className="text-[#667085]">Organization:</span> {detailBranch.organization.name}</div>}
              {detailBranch.region && <div><span className="text-[#667085]">Region:</span> {detailBranch.region.name}</div>}
              {detailBranch.address && <div><span className="text-[#667085]">Alamat:</span> {detailBranch.address}</div>}
              {detailBranch.city && <div><span className="text-[#667085]">Kota:</span> {detailBranch.city}</div>}
              {detailBranch.phone && <div><span className="text-[#667085]">Telepon:</span> {detailBranch.phone}</div>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-lg font-bold text-blue-700">{detailBranch._count.users}</div>
                <div className="text-xs text-blue-600">Users</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-lg font-bold text-amber-700">{detailBranch._count.warehouses}</div>
                <div className="text-xs text-amber-600">Warehouses</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center">
                <div className="text-lg font-bold text-purple-700">{detailBranch._count.hubs}</div>
                <div className="text-xs text-purple-600">Hubs</div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setDetailBranch(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          Belum ada branch. Klik &ldquo;Buat Branch&rdquo; untuk menambah.
        </div>
      ) : (
        <div className="rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {branches.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-[#101828]">{b.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#667085]">{b.code || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{b.organization?.name || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{b.region?.name || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{b.city || '-'}</td>
                  <td className="px-4 py-3">{b._count.users}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => viewDetail(b.id)} className="text-xs text-[#667085] hover:underline">Detail</button>
                      <button onClick={() => openEdit(b)} className="text-xs text-[#2563eb] hover:underline">Edit</button>
                      <button onClick={() => { if (confirm(`Hapus branch "${b.name}"?`)) deleteBranch(b.id); }} className="text-xs text-red-600 hover:underline">Hapus</button>
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
