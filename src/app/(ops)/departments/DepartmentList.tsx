"use client";

import { useEffect, useState } from 'react';

type Department = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  company: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  createdAt: string;
};

type Option = { id: string; name: string };

export default function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', code: '', branchId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [deptRes, branchRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/branches'),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (branchRes.ok) setBranches(await branchRes.json());
    } catch {}
    setLoading(false);
  }

  async function searchDepts(q: string) {
    if (!q) return fetchData();
    try {
      const res = await fetch(`/api/departments?q=${encodeURIComponent(q)}`);
      if (res.ok) setDepartments(await res.json());
    } catch {}
  }

  function openCreate() {
    setEditDept(null);
    setForm({ name: '', code: '', branchId: '' });
    setShowForm(true);
    setError('');
  }

  function openEdit(d: Department) {
    setEditDept(d);
    setForm({ name: d.name, code: d.code || '', branchId: d.branch?.id || '' });
    setShowForm(true);
    setError('');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const url = editDept ? `/api/departments/${editDept.id}` : '/api/departments';
    const method = editDept ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, code: form.code || null, branchId: form.branchId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); setSaving(false); return; }
      setShowForm(false);
      setSuccess(editDept ? 'Departemen berhasil diupdate' : 'Departemen berhasil dibuat');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Terjadi kesalahan'); }
    setSaving(false);
  }

  async function deleteDept(id: string) {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
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
          placeholder="Cari departemen..."
          value={search}
          onChange={e => { setSearch(e.target.value); searchDepts(e.target.value); }}
        />
        <button onClick={openCreate} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] whitespace-nowrap">
          + Buat Departemen
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{editDept ? 'Edit Departemen' : 'Buat Departemen'}</h3>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama *</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Kode</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Contoh: HR, FIN, OPS" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Branch</label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })}>
                  <option value="">— Tanpa Branch —</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
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

      {departments.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-[#667085]">
          Belum ada departemen. Klik &ldquo;Buat Departemen&rdquo; untuk menambah.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F7F9FC] text-xs uppercase text-[#667085]">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-[#F7F9FC]">
                  <td className="px-4 py-3 font-medium text-[#101828]">{d.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#667085]">{d.code || '—'}</td>
                  <td className="px-4 py-3 text-[#667085]">{d.branch?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(d)} className="mr-2 rounded-lg border px-3 py-1 text-xs hover:bg-gray-50">Edit</button>
                    <button onClick={() => { if (confirm(`Hapus "${d.name}"?`)) deleteDept(d.id); }} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50">Hapus</button>
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
