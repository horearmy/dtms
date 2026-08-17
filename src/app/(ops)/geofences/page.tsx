"use client";

import { useEffect, useState } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost } from '@/components/ui';
import { formatDate } from '@/lib/constants';

type Geofence = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  type: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  events: { id: string; eventType: string; driver: { name: string }; createdAt: string }[];
};

export default function GeofencesPage() {
  const [items, setItems] = useState<Geofence[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Geofence | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radiusMeters: '500', type: 'OPERATIONAL_AREA', description: '', active: 'true' });

  async function load() {
    const res = await fetch('/api/geofences');
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEdit(null);
    setForm({ name: '', latitude: '', longitude: '', radiusMeters: '500', type: 'OPERATIONAL_AREA', description: '', active: 'true' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(g: Geofence) {
    setEdit(g);
    setForm({ name: g.name, latitude: String(g.latitude), longitude: String(g.longitude), radiusMeters: String(g.radiusMeters), type: g.type, description: g.description || '', active: String(g.active) });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(edit ? `/api/geofences/${edit.id}` : '/api/geofences', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), radiusMeters: Number(form.radiusMeters), active: form.active === 'true' }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg(data.error || 'Gagal menyimpan');
    setOpen(false);
    await load();
  }
  async function toggleActive(g: Geofence) {
    await fetch(`/api/geofences/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !g.active }),
    });
    await load();
  }
  async function remove(g: Geofence) {
    if (!confirm(`Hapus geofence "${g.name}"?`)) return;
    const res = await fetch(`/api/geofences/${g.id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  const typeLabel: Record<string, string> = {
    WAREHOUSE: 'Gudang',
    HUB: 'Hub',
    OPERATIONAL_AREA: 'Area Operasional',
    DESTINATION: 'Destinasi',
  };
  const typeColor: Record<string, string> = {
    WAREHOUSE: 'bg-indigo-100 text-indigo-700',
    HUB: 'bg-amber-100 text-amber-700',
    OPERATIONAL_AREA: 'bg-sky-100 text-sky-700',
    DESTINATION: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Geofencing</h1>
          <p className="text-sm text-[#667085]">Perimeter area — alert otomatis saat driver masuk/keluar</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Geofence</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((g) => (
          <div key={g.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#101828]">{g.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeColor[g.type] || 'bg-[#F7F9FC] text-[#667085]'}`}>{typeLabel[g.type] || g.type}</span>
                </div>
                <p className="mt-1 text-xs text-[#667085]">
                  {g.latitude.toFixed(5)}, {g.longitude.toFixed(5)} · radius {Math.round(g.radiusMeters)} m
                </p>
                {g.description && <p className="mt-1 text-xs text-[#667085]">{g.description}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E4E7EC] text-[#667085]'}`}>{g.active ? 'Aktif' : 'Nonaktif'}</span>
            </div>

            <div className="mt-3 space-y-1 border-t border-[#E4E7EC] pt-3">
              {g.events.length === 0 ? (
                <p className="text-xs text-[#667085]">Belum ada event masuk/keluar</p>
              ) : (
                g.events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between text-xs">
                    <span className={ev.eventType === 'ENTER' ? 'font-semibold text-emerald-600' : 'font-semibold text-red-500'}>
                      {ev.eventType === 'ENTER' ? 'MASUK' : 'KELUAR'} · {ev.driver.name}
                    </span>
                    <span className="text-[#667085]">{formatDate(ev.createdAt)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex gap-3 text-xs">
              <button onClick={() => toggleActive(g)} className="font-semibold text-[#667085] hover:underline">{g.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
              <button onClick={() => openEdit(g)} className="font-semibold text-[#0D6EFD] hover:underline">Edit</button>
              <button onClick={() => remove(g)} className="font-semibold text-red-500 hover:underline">Hapus</button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center text-sm text-[#667085]">
            Belum ada geofence
          </p>
        )}
      </div>

      <Modal open={open} title={edit ? 'Edit Geofence' : 'Tambah Geofence'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Nama" required>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Gudang Pusat Jakarta" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" required>
              <input required type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className={inputCls} placeholder="-6.213" />
            </Field>
            <Field label="Longitude" required>
              <input required type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className={inputCls} placeholder="106.845" />
            </Field>
            <Field label="Radius (meter)">
              <input type="number" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Tipe">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                <option value="WAREHOUSE">Gudang</option>
                <option value="HUB">Hub</option>
                <option value="OPERATIONAL_AREA">Area Operasional</option>
                <option value="DESTINATION">Destinasi</option>
              </select>
            </Field>
          </div>
          <Field label="Deskripsi">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={form.active} onChange={(e) => setForm({ ...form, active: e.target.value })} className={inputCls}>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </Field>
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
