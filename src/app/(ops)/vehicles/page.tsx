"use client";

import { useEffect, useState } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import { formatNumber, MAINTENANCE_DISTANCE_KM } from '@/lib/constants';
import PhotoField from '@/components/PhotoField';

type Vehicle = {
  id: string;
  vehicleNumber: string;
  type: string;
  capacity: number;
  status: string;
  totalDistanceKm: number;
  photoFront: string | null;
  photoBack: string | null;
  photoRight: string | null;
  photoLeft: string | null;
  _count?: { assignments: number };
  busy?: boolean;
  activeTracking?: string | null;
  returning?: boolean;
};

const emptyForm = {
  vehicleNumber: '',
  type: '',
  capacity: '',
  status: 'AVAILABLE',
  totalDistanceKm: '',
  photoFront: null as string | null,
  photoBack: null as string | null,
  photoRight: null as string | null,
  photoLeft: null as string | null,
};

const PHOTO_LABELS: { key: keyof typeof emptyForm; label: string }[] = [
  { key: 'photoFront', label: 'Depan' },
  { key: 'photoBack', label: 'Belakang' },
  { key: 'photoRight', label: 'Samping Kanan' },
  { key: 'photoLeft', label: 'Samping Kiri' },
];

export default function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/vehicles');
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEdit(null);
    setForm(emptyForm);
    setMsg('');
    setOpen(true);
  }
  function openEdit(v: Vehicle) {
    setEdit(v);
    setForm({
      vehicleNumber: v.vehicleNumber,
      type: v.type,
      capacity: String(v.capacity),
      status: v.status,
      totalDistanceKm: String(v.totalDistanceKm ?? 0),
      photoFront: v.photoFront,
      photoBack: v.photoBack,
      photoRight: v.photoRight,
      photoLeft: v.photoLeft,
    });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit && (!form.photoFront || !form.photoBack || !form.photoRight || !form.photoLeft)) {
      return setMsg('Foto kendaraan (depan, belakang, samping kanan & kiri) wajib diisi');
    }
    setLoading(true);
    const payload = {
      ...form,
      totalDistanceKm: form.totalDistanceKm === '' ? undefined : Number(form.totalDistanceKm),
    };
    const res = await fetch(edit ? `/api/vehicles/${edit.id}` : '/api/vehicles', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  const photoCount = (v: Vehicle) => [v.photoFront, v.photoBack, v.photoRight, v.photoLeft].filter(Boolean).length;

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
                <th className="px-4 py-3">Jarak Tempuh</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3">Penugasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                    <button onClick={() => (window.location.href = `/vehicles/${v.id}`)} className="hover:text-brand-600 hover:underline">{v.vehicleNumber}</button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.type}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(v.capacity)}</td>
                  <td className="px-4 py-3">
                    <div className="min-w-[110px]">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className={v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM ? 'font-semibold text-red-600' : 'text-slate-500'}>
                          {formatNumber(Math.round(v.totalDistanceKm || 0))} km
                        </span>
                        <span className="text-slate-400">{formatNumber(MAINTENANCE_DISTANCE_KM)} km</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM ? 'bg-red-500' : v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, ((v.totalDistanceKm || 0) / MAINTENANCE_DISTANCE_KM) * 100)}%` }}
                        />
                      </div>
                      {v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM && (
                        <div className="mt-1 text-[10px] font-bold text-red-600">⚠ Perlu Perawatan</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {photoCount(v) > 0 ? (
                      <div className="flex gap-1">
                        {[v.photoFront, v.photoBack, v.photoRight, v.photoLeft].map((p, i) =>
                          p ? (
                            <img key={i} src={p} alt={`foto ${i + 1}`}
                              className="h-9 w-12 rounded border border-slate-200 object-cover"
                              onClick={() => window.open(p, '_blank')}
                            />
                          ) : null
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v._count?.assignments || 0}</td>
                  <td className="px-4 py-3">
                    {v.returning ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                        Kembali ke Gudang
                      </span>
                    ) : v.busy ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Perjalanan{v.activeTracking ? ` · ${v.activeTracking}` : ''}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700'
                        : v.status === 'IN_USE' ? 'bg-amber-100 text-amber-700'
                        : v.status === 'MAINTENANCE' ? 'bg-red-100 text-red-700'
                        : 'bg-slate-200 text-slate-500'}`}>
                        {v.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => (window.location.href = `/vehicles/${v.id}`)} className="text-xs font-semibold text-brand-600 hover:underline">Detail</button>
                    <button onClick={() => openEdit(v)} className="ml-3 text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => remove(v)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={8} text="Belum ada kendaraan" />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} title={edit ? 'Edit Kendaraan' : 'Tambah Kendaraan'} onClose={() => setOpen(false)} wide>
        <form onSubmit={save} className="space-y-4">
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
            {edit && (
              <Field label="Jarak Tempuh (km)">
                <input
                  type="number"
                  value={form.totalDistanceKm}
                  onChange={(e) => setForm({ ...form, totalDistanceKm: e.target.value })}
                  className={inputCls}
                  min={0}
                />
              </Field>
            )}
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600">Foto Kendaraan <span className="text-red-500">*</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PHOTO_LABELS.map(({ key, label }) => (
                <PhotoField key={key} label={label} value={form[key]} onChange={(url) => setForm({ ...form, [key]: url })} />
              ))}
            </div>
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
