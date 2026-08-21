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

type OrgDetail = Org & {
  regions: {
    id: string; name: string; code: string | null;
    _count: { branches: number };
    branches: {
      id: string; name: string; code: string | null; city: string | null;
      _count: { users: number; warehouses: number; hubs: number };
    }[];
  }[];
  branches: {
    id: string; name: string; code: string | null; city: string | null;
    users: { id: string; name: string; username: string; role: string; status: string }[];
    _count: { users: number; warehouses: number; hubs: number };
  }[];
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN_OPERASIONAL: 'Admin Operasional',
  DISPATCHER: 'Dispatcher', WAREHOUSE: 'Warehouse', SUPERVISOR: 'Supervisor',
  MANAGEMENT: 'Management', CUSTOMER_SERVICE: 'Customer Service', DRIVER: 'Driver', CUSTOMER: 'Customer',
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
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);

  async function fetchOrgs() {
    setLoading(true);
    try { const res = await fetch('/api/organizations'); if (res.ok) setOrgs(await res.json()); } catch {}
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

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/organizations/${id}`);
      if (res.ok) setDetail(await res.json());
    } catch {}
    setDetailLoading(false);
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

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#101828]">{detail.name}</h3>
                {detail.code && <p className="text-xs font-mono text-[#667085]">{detail.code}</p>}
                {detail.description && <p className="mt-1 text-sm text-[#667085]">{detail.description}</p>}
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-lg font-bold text-blue-700">{detail._count.regions}</div>
                <div className="text-xs text-blue-600">Regions</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <div className="text-lg font-bold text-amber-700">{detail._count.branches}</div>
                <div className="text-xs text-amber-600">Branches</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <div className="text-lg font-bold text-emerald-700">
                  {detail.branches.reduce((sum, b) => sum + b._count.users, 0)}
                </div>
                <div className="text-xs text-emerald-600">Total Users</div>
              </div>
            </div>

            {/* Branches & Users */}
            {detail.branches.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-3 text-sm font-bold text-[#101828]">Branch & Users</h4>
                <div className="space-y-3">
                  {detail.branches.map(branch => (
                    <div key={branch.id} className="rounded-lg border border-[#E4E7EC] p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm text-[#101828]">{branch.name}</span>
                          {branch.city && <span className="ml-2 text-xs text-[#667085]">({branch.city})</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-[#667085]">
                          <span>{branch._count.users} user</span>
                          <span>{branch._count.warehouses} gudang</span>
                          <span>{branch._count.hubs} hub</span>
                        </div>
                      </div>
                      {branch.users.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {branch.users.map(u => (
                            <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-[#F7F9FC] border border-[#E4E7EC] px-2.5 py-0.5 text-xs">
                              <span className="font-medium text-[#101828]">{u.name}</span>
                              <span className="text-[#667085]">({ROLE_LABELS[u.role] || u.role})</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {branch.users.length === 0 && (
                        <p className="mt-2 text-xs text-[#667085] italic">Belum ada user</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regions */}
            {detail.regions.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-3 text-sm font-bold text-[#101828]">Regions</h4>
                <div className="space-y-2">
                  {detail.regions.map(region => (
                    <div key={region.id} className="flex items-center justify-between rounded-lg border border-[#E4E7EC] px-3 py-2">
                      <div>
                        <span className="font-medium text-sm text-[#101828]">{region.name}</span>
                        {region.code && <span className="ml-2 text-xs font-mono text-[#667085]">{region.code}</span>}
                      </div>
                      <span className="text-xs text-[#667085]">{region._count.branches} branch</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailLoading && <p className="mt-4 text-sm text-[#667085]">Memuat detail...</p>}

            <div className="mt-5 flex justify-end">
              <button onClick={() => setDetail(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Tutup</button>
            </div>
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
                <button onClick={() => openDetail(o.id)} className="rounded-lg border px-3 py-1.5 text-xs text-[#667085] hover:bg-gray-50">Detail</button>
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
