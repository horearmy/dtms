"use client";

import { useEffect, useState } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import { formatDate } from '@/lib/constants';

type Driver = {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  status: string;
  user: { username: string } | null;
  _count?: { assignments: number };
  busy?: boolean;
  activeTracking?: string | null;
  returning?: boolean;
  returnedAt?: string | null;
};

export default function DriversPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Driver | null>(null);
  const [form, setForm] = useState({ employeeId: '', name: '', phone: '', status: 'ACTIVE' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/drivers');
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEdit(null);
    setForm({ employeeId: '', name: '', phone: '', status: 'ACTIVE' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(d: Driver) {
    setEdit(d);
    setForm({ employeeId: d.employeeId, name: d.name, phone: d.phone, status: d.status });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(edit ? `/api/drivers/${edit.id}` : '/api/drivers', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg(data.error || 'Gagal menyimpan');
    setOpen(false);
    await load();
  }
  async function remove(d: Driver) {
    if (!confirm(`Hapus driver "${d.name}"?`)) return;
    const res = await fetch(`/api/drivers/${d.id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Drivers</h1>
          <p className="text-sm text-slate-500">Manajemen kurir & aset kendaraan</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Driver</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Akun</th>
                <th className="px-4 py-3">Penugasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.employeeId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{d.name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{d.user?.username || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{d._count?.assignments || 0}</td>
                  <td className="px-4 py-3">
                    {d.returning ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                        Kembali ke Gudang
                      </span>
                    ) : d.busy ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Perjalanan{d.activeTracking ? ` · ${d.activeTracking}` : ''}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        {d.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(d)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => remove(d)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={7} text="Belum ada driver" />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} title={edit ? 'Edit Driver' : 'Tambah Driver'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee ID" required>
              <input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={inputCls} placeholder="DRV-XXX" />
            </Field>
            <Field label="Nama" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Telepon" required>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </Field>
          </div>
          {msg && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}