"use client";

import { useEffect, useState } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import { formatDate } from '@/lib/constants';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  createdAt: string;
  _count?: { sentBy: number; receivedBy: number };
};

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', city: '', postalCode: '',
  });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (res.ok) setItems(await res.json());
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [q]);

  function openNew() {
    setEdit(null);
    setForm({ name: '', phone: '', email: '', address: '', city: '', postalCode: '' });
    setMsg('');
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEdit(c);
    setForm({
      name: c.name, phone: c.phone, email: c.email || '', address: c.address || '',
      city: c.city || '', postalCode: c.postalCode || '',
    });
    setMsg('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(edit ? `/api/customers/${edit.id}` : '/api/customers', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error || 'Gagal menyimpan');
      return;
    }
    setOpen(false);
    await load();
  }

  async function remove(c: Customer) {
    if (!confirm(`Hapus customer "${c.name}"?`)) return;
    const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else alert((await res.json()).error || 'Gagal menghapus');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Data pengirim & penerima</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Customer</button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / telepon / kota..."
          className="w-full bg-transparent text-sm focus:outline-none" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Telepon</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3">Kota</th>
                <th className="px-4 py-3">Kiriman</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{c.address || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.city || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{(c._count?.sentBy || 0) + (c._count?.receivedBy || 0)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => remove(c)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={7} text="Belum ada customer" />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} title={edit ? 'Edit Customer' : 'Tambah Customer'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Telepon" required>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Kota">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="Alamat">
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} rows={2} />
          </Field>
          <Field label="Kode Pos">
            <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className={inputCls} />
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