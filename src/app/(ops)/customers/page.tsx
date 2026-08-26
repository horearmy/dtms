"use client";

import { useEffect, useState, useCallback } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';
import CountryCodeSelect, { detectDial, splitPhone } from '@/components/CountryCodeSelect';
import Pagination from '@/components/Pagination';
import { formatDate } from '@/lib/constants';
import { csrfHeaders } from '@/lib/csrf';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  _count?: { sentBy: number; receivedBy: number };
};

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', city: '', postalCode: '',
    latitude: '', longitude: '',
  });
  const [dial, setDial] = useState('+62');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch {
      // silently fail — user can retry via search/page change
    }
    setLoading(false);
  }, [q, page]);

  useEffect(() => { setPage(1); }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  function openNew() {
    setEdit(null);
    setForm({ name: '', phone: '', email: '', address: '', city: '', postalCode: '', latitude: '', longitude: '' });
    setDial(detectDial());
    setMsg('');
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEdit(c);
    const sp = splitPhone(c.phone);
    setDial(sp.dial);
    setForm({
      name: c.name, phone: sp.local, email: c.email || '', address: c.address || '',
      city: c.city || '', postalCode: c.postalCode || '',
      latitude: c.latitude != null ? String(c.latitude) : '',
      longitude: c.longitude != null ? String(c.longitude) : '',
    });
    setMsg('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const fullPhone = dial + form.phone.replace(/^0+/, '');
      const res = await fetch(edit ? `/api/customers/${edit.id}` : '/api/customers', {
        method: edit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ ...form, phone: fullPhone }),
      });
      const data = await res.json().catch(() => ({ error: 'Server tidak merespons' }));
      if (!res.ok) {
        setMsg(data.error || 'Gagal menyimpan');
        return;
      }
      setOpen(false);
      await load();
    } catch (err) {
      setMsg('Gagal menghubungi server');
      console.error('save customer error:', err);
    }
  }

  async function remove(c: Customer) {
    if (!confirm(`Hapus customer "${c.name}"?`)) return;
    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE', headers: csrfHeaders() });
      if (!res.ok) alert((await res.json()).error || 'Gagal menghapus');
      else await load();
    } catch {
      alert('Gagal menghubungi server');
    }
  }

  const pickedLocation: PickedLocation = {
    lat: form.latitude !== '' ? Number(form.latitude) : null,
    lng: form.longitude !== '' ? Number(form.longitude) : null,
    address: form.address,
    city: form.city,
    postalCode: form.postalCode,
  };

  function onPick(loc: PickedLocation) {
    setForm((f) => ({
      ...f,
      latitude: loc.lat != null ? String(loc.lat) : f.latitude,
      longitude: loc.lng != null ? String(loc.lng) : f.longitude,
      address: loc.address || f.address,
      city: loc.city || f.city,
      postalCode: loc.postalCode || f.postalCode,
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Customers</h1>
          <p className="text-sm text-[#667085]">Data pengirim & penerima</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Customer</button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / telepon / kota..."
          className="w-full bg-transparent text-sm focus:outline-none" />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Koordinat</th>
                <th className="px-4 py-3">Kiriman</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-medium text-[#101828]">{c.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{c.phone}</td>
                  <td className="px-4 py-3 text-[#667085]">{c.address || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{c.city || '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {c.latitude != null && c.longitude != null
                      ? `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{(c._count?.sentBy || 0) + (c._count?.receivedBy || 0)}</td>
                  <td className="px-4 py-3 text-[#667085]">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-xs font-semibold text-[#0D6EFD] hover:underline">Edit</button>
                    <button onClick={() => remove(c)} className="ml-3 text-xs font-semibold text-[#F5222D] hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={8} text="Belum ada customer" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>

      <Modal open={open} wide title={edit ? 'Edit Customer' : 'Tambah Customer'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Telepon" required>
              <div className="flex gap-2">
                <CountryCodeSelect value={dial} onChange={setDial} />
                <input
                  required
                  inputMode="tel"
                  placeholder="812xxxxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                  className={inputCls}
                />
              </div>
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Kota">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="Lokasi (peta)">
            <LocationPicker value={pickedLocation} onChange={onPick} />
          </Field>
          <Field label="Alamat">
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} rows={2} />
          </Field>
          <Field label="Kode Pos">
            <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={inputCls} />
          </Field>
          {msg && <div className="rounded-lg bg-[#F5222D]/10 px-3 py-2 text-sm text-[#F5222D]">{msg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
