"use client";

import { useEffect, useState } from 'react';

type Org = {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  description: string | null;
  logoUrl: string | null;
  active: boolean;
  createdAt: string;
  _count: { regions: number; branches: number };
};

export default function OrganizationList() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchOrgs(); }, []);

  async function fetchOrgs() {
    setLoading(true);
    try {
      const res = await fetch('/api/organizations');
      if (res.ok) setOrgs(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  function openCreate() {
    setEditOrg(null);
    setForm({ name: '', code: '', description: '' });
    setShowForm(true);
    setError('');
  }

  function openEdit(o: Org) {
    setEditOrg(o);
    setForm({ name: o.name, code: o.code || '', description: o.description || '' });
    setShowForm(true);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const url = editOrg ? `/api/organizations/${editOrg.id}` : '/api/organizations';
    const method = editOrg ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, code: form.code || null, description: form.description || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); setSaving(false); return; }
      setShowForm(false);
      setSuccess(editOrg ? 'Organization berhasil diupdate' : 'Organization berhasil dibuat');
      fetchOrgs();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Terjadi kesalahan'); }
    setSaving(false);
  }

  async function deleteOrg(id: string) {
    try {
      const res = await fetch(`/api/organizations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal menghapus'); return; }
      fetchOrgs();
    } catch { alert('Terjadi kesalahan'); }
  }

  if (loading) return <div className="text-sm text-[#667085] py-8">Memuat data...</div>;

  return (
    <div>
      {success && <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]">
          + Buat Organization
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{editOrg ? 'Edit Organization' : 'Buat Organization'}</h3>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama *</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kode</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Contoh: DIV01" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Deskripsi</label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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

      {orgs.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          Belum ada organization. Klik &ldquo;Buat Organization&rdquo; untuk menambah.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map(o => (
            <div key={o.id} className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[#101828]">{o.name}</h3>
                  {o.code && <p className="mt-0.5 text-xs font-mono text-[#667085]">{o.code}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {o.active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              {o.description && <p className="mt-2 text-sm text-[#667085] line-clamp-2">{o.description}</p>}
              <div className="mt-3 flex gap-4 text-xs text-[#667085]">
                <span>{o._count.regions} region</span>
                <span>{o._count.branches} branch</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(o)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50">Edit</button>
                <button onClick={() => { if (confirm(`Hapus "${o.name}"?`)) deleteOrg(o.id); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
