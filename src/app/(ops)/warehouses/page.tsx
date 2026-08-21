'use client';

import { useCallback, useEffect, useState } from 'react';
import { Warehouse, Plus, Pencil, Trash2, MapPin, Search } from 'lucide-react';
import Pagination from '@/components/Pagination';

type WarehouseItem = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  active: boolean;
  createdAt: string;
};

const inputCls = 'w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm text-[#101828] placeholder:text-[#98A2B3] focus:border-[#0D6EFD] focus:outline-none focus:ring-1 focus:ring-[#0D6EFD]';
const btnPrimary = 'rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B5FD5] disabled:opacity-50';
const btnGhost = 'rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-medium text-[#344054] hover:bg-[#F7F9FC]';

export default function WarehousesPage() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<WarehouseItem | null>(null);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', latitude: '', longitude: '', radiusMeters: '500', active: true });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    const q = search ? `&q=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/warehouses?page=${page}&pageSize=${pageSize}${q}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEdit(null);
    setForm({ name: '', code: '', address: '', city: '', latitude: '', longitude: '', radiusMeters: '500', active: true });
    setMsg('');
    setOpen(true);
  }

  function openEdit(w: WarehouseItem) {
    setEdit(w);
    setForm({
      name: w.name,
      code: w.code || '',
      address: w.address || '',
      city: w.city || '',
      latitude: w.latitude != null ? String(w.latitude) : '',
      longitude: w.longitude != null ? String(w.longitude) : '',
      radiusMeters: String(w.radiusMeters),
      active: w.active,
    });
    setMsg('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    const body = {
      ...form,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      radiusMeters: Number(form.radiusMeters) || 500,
    };
    const res = await fetch(edit ? `/api/warehouses/${edit.id}` : '/api/warehouses', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setMsg(data.error || 'Gagal menyimpan');
    setOpen(false);
    await load();
  }

  async function remove(w: WarehouseItem) {
    if (!confirm(`Hapus gudang "${w.name}"?`)) return;
    const res = await fetch(`/api/warehouses/${w.id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Gudang</h1>
          <p className="text-sm text-[#667085]">Manajemen lokasi gudang & area operasi</p>
        </div>
        <button onClick={openNew} className={btnPrimary + ' flex items-center gap-2'}>
          <Plus size={16} /> Tambah Gudang
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari nama, kode, kota..." className={inputCls + ' pl-9'} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nama Gudang</th>
                <th className="px-4 py-3">Kode</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">Radius</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E7F0FF]">
                        <Warehouse size={16} className="text-[#0D6EFD]" />
                      </span>
                      <span className="font-medium text-[#101828]">{w.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#667085]">{w.code || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{w.city || '-'}</td>
                  <td className="px-4 py-3">
                    {w.latitude && w.longitude ? (
                      <span className="flex items-center gap-1 text-xs text-[#667085]">
                        <MapPin size={12} className="text-[#0D6EFD]" />
                        {w.latitude.toFixed(5)}, {w.longitude.toFixed(5)}
                      </span>
                    ) : <span className="text-xs text-[#667085]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{w.radiusMeters}m</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${w.active ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-[#F7F9FC] text-[#667085]'}`}>
                      {w.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(w)} className="text-xs font-semibold text-[#0D6EFD] hover:underline">Edit</button>
                    <button onClick={() => remove(w)} className="ml-3 text-xs font-semibold text-[#F5222D] hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#667085]">Belum ada gudang</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-[#101828]">{edit ? 'Edit Gudang' : 'Tambah Gudang'}</h2>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Nama Gudang <span className="text-[#F5222D]">*</span></label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Gudang Pusat" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Kode</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} placeholder="WH-001" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Kota</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} placeholder="Jakarta" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Alamat</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Jl. Contoh No. 123" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Latitude</label>
                  <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className={inputCls} placeholder="-6.2088" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Longitude</label>
                  <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className={inputCls} placeholder="106.8456" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Radius (meter)</label>
                  <input type="number" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#667085]">Status</label>
                  <select value={form.active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })} className={inputCls}>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
              </div>
              {msg && <div className="rounded-lg bg-[#FEF0F0] px-3 py-2 text-sm text-[#F5222D]">{msg}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
                <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
