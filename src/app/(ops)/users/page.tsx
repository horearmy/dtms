"use client";

import { useEffect, useState } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/constants';

type UserRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  status: string;
  phone: string | null;
  mustChangePassword: boolean;
  lastPasswordChange: string | null;
  createdAt: string;
  driver: { id: string; employeeId: string; name: string } | null;
};

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse / Staff Gudang' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'ADMIN_OPERASIONAL', label: 'Admin Operasional' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN_OPERASIONAL: 'bg-blue-100 text-blue-700',
  DISPATCHER: 'bg-cyan-100 text-cyan-700',
  WAREHOUSE: 'bg-indigo-100 text-indigo-700',
  CUSTOMER_SERVICE: 'bg-teal-100 text-teal-700',
  SUPERVISOR: 'bg-orange-100 text-orange-700',
  MANAGEMENT: 'bg-slate-100 text-slate-700',
  DRIVER: 'bg-emerald-100 text-emerald-700',
  CUSTOMER: 'bg-rose-100 text-rose-700',
};

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: '', username: '', phone: '', role: 'WAREHOUSE', status: 'ACTIVE', password: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/users');
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEdit(null);
    setForm({ name: '', username: '', phone: '', role: 'WAREHOUSE', status: 'ACTIVE', password: '' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(u: UserRow) {
    setEdit(u);
    setForm({ name: u.name, username: u.username, phone: u.phone || '', role: u.role, status: u.status, password: '' });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(edit ? `/api/users/${edit.id}` : '/api/users', {
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
  async function remove(u: UserRow) {
    if (!confirm(`Hapus akun "${u.username}"?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) await load();
    else {
      const data = await res.json();
      setMsg(data.error || 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen User</h1>
          <p className="text-sm text-slate-500">Kelola akun login staff: Warehouse, CS, Supervisor, dan lainnya</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah User</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Terhubung</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Password Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{u.name}</div>
                    <div className="font-mono text-xs text-slate-500">{u.username}{u.phone ? ` · ${u.phone}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-700'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.driver ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Driver · {u.driver.employeeId}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(u.lastPasswordChange)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(u)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => remove(u)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={6} text="Belum ada user" />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} title={edit ? 'Edit User' : 'Tambah User'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Nama Lengkap" required>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Username (login)" required>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={inputCls}
                readOnly={!!edit}
                placeholder={edit ? undefined : 'mis. gudang2'}
              />
            </Field>
            <Field label={edit ? 'Password Baru' : 'Password'} required={!edit}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputCls}
                placeholder={edit ? 'kosongkan jika tidak diganti' : 'min. 8 karakter'}
              />
            </Field>
            <Field label="Role" required>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Telepon">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
              </Field>
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