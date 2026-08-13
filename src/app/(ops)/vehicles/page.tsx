"use client";

import { useEffect, useState } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import { formatNumber } from '@/lib/constants';

type Vehicle = {
  id: string;
  vehicleNumber: string;
  type: string;
  capacity: number;
  status: string;
  _count?: { assignments: number };
};

export default function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ vehicleNumber: '', type: '', capacity: '', status: 'AVAILABLE' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/vehicles');
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEdit(null);
    setForm({ vehicleNumber: '', type: '', capacity: '', status: 'AVAILABLE' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(v: Vehicle) {
    setEdit(v);
    setForm({ vehicleNumber: v.vehicleNumber, type: v.type, capacity: String(v.capacity), status: v.status });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(edit ? `/api/vehicles/${edit.id}` : '/api/vehicles', {
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
  async function remove(v: Vehicle) {
    if (!confirm(`Hapus kendaraan "${v.vehicleNumber}"?`)) return;
    const res = await fetch(`/api/vehicles/${v.id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vehicles</h1>
          <p className="text-sm text-slate-500">Manajemen armada</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Kendaraan</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">No. Kendaraan</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Kapasitas (kg)</th>
                <th className="px-4 py-3">Penugasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">{v.vehicleNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{v.type}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(v.capacity)}</td>
                  <td className="px-4 py-3 text-slate-600">{v._count?.assignments || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700'
                      : v.status === 'IN_USE' ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-500'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(v)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => remove(v)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={6} text="Belum ada kendaraan" />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} title={edit ? 'Edit Kendaraan' : 'Tambah Kendaraan'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="No. Kendaraan" required>
              <input required value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} className={inputCls} placeholder="B 1234 CD" />
            </Field>
            <Field label="Jenis" required>
              <input required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls} placeholder="Pickup / Truck Box / Van" />
            </Field>
            <Field label="Kapasitas (kg)">
              <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="AVAILABLE">Tersedia</option>
                <option value="IN_USE">Digunakan</option>
                <option value="MAINTENANCE">Perawatan</option>
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