"use client";

import { useEffect, useState, useCallback } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import Pagination from '@/components/Pagination';
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    const res = await fetch(`/api/vehicles?page=${page}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

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
          <h1 className="text-xl font-bold text-[#101828]">Vehicles</h1>
          <p className="text-sm text-[#667085]">Manajemen armada</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Kendaraan</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
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
                <tr key={v.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-[#101828]">
                    <button onClick={() => (window.location.href = `/vehicles/${v.id}`)} className="hover:text-[#0D6EFD] hover:underline">{v.vehicleNumber}</button>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{v.type}</td>
                  <td className="px-4 py-3 text-[#667085]">{formatNumber(v.capacity)}</td>
                  <td className="px-4 py-3">
                    <div className="min-w-[110px]">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className={v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM ? 'font-semibold text-[#F5222D]' : 'text-[#667085]'}>
                          {formatNumber(Math.round(v.totalDistanceKm || 0))} km
                        </span>
                        <span className="text-[#667085]">{formatNumber(MAINTENANCE_DISTANCE_KM)} km</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                        <div
                          className={`h-full rounded-full ${v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM ? 'bg-[#F5222D]' : v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM * 0.8 ? 'bg-[#FF8A00]' : 'bg-[#16B364]'}`}
                          style={{ width: `${Math.min(100, ((v.totalDistanceKm || 0) / MAINTENANCE_DISTANCE_KM) * 100)}%` }}
                        />
                      </div>
                      {v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM && (
                        <div className="mt-1 text-[10px] font-bold text-[#F5222D]">⚠ Perlu Perawatan</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {photoCount(v) > 0 ? (
                      <div className="flex gap-1">
                        {[v.photoFront, v.photoBack, v.photoRight, v.photoLeft].map((p, i) =>
                          p ? (
                            <img key={i} src={p} alt={`foto ${i + 1}`}
                              className="h-9 w-12 rounded border border-[#E4E7EC] object-cover"
                              onClick={() => window.open(p, '_blank')}
                            />
                          ) : null
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-[#667085]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{v._count?.assignments || 0}</td>
                  <td className="px-4 py-3">
                    {v.returning ? (
                      <span className="rounded-full bg-[#FFF7E6] px-2 py-0.5 text-xs font-semibold text-[#FF8A00]">
                        Kembali ke Gudang
                      </span>
                    ) : v.busy ? (
                      <span className="rounded-full bg-[#FFF2E0] px-2 py-0.5 text-xs font-semibold text-[#FF8A00]">
                        Perjalanan{v.activeTracking ? ` · ${v.activeTracking}` : ''}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.status === 'AVAILABLE' ? 'bg-[#E6F9EF] text-[#16B364]'
                        : v.status === 'IN_USE' ? 'bg-[#FFF2E0] text-[#FF8A00]'
                        : v.status === 'MAINTENANCE' ? 'bg-[#FEF0F0] text-[#F5222D]'
                        : 'bg-[#F7F9FC] text-[#667085]'}`}>
                        {v.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => (window.location.href = `/vehicles/${v.id}`)} className="text-xs font-semibold text-[#0D6EFD] hover:underline">Detail</button>
                    <button onClick={() => openEdit(v)} className="ml-3 text-xs font-semibold text-[#0D6EFD] hover:underline">Edit</button>
                    <button onClick={() => remove(v)} className="ml-3 text-xs font-semibold text-[#F5222D] hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={8} text="Belum ada kendaraan" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
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
            <div className="mb-2 text-xs font-semibold text-[#667085]">Foto Kendaraan <span className="text-[#F5222D]">*</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PHOTO_LABELS.map(({ key, label }) => (
                <PhotoField key={key} label={label} value={form[key]} onChange={(url) => setForm({ ...form, [key]: url })} />
              ))}
            </div>
          </div>
          {msg && <div className="rounded-lg bg-[#FEF0F0] px-3 py-2 text-sm text-[#F5222D]">{msg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
