"use client";

import { useEffect, useState, useCallback } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import Pagination from '@/components/Pagination';
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
  ADMIN_OPERASIONAL: 'bg-[#0D6EFD]/10 text-[#0D6EFD]',
  DISPATCHER: 'bg-cyan-100 text-cyan-700',
  WAREHOUSE: 'bg-indigo-100 text-indigo-700',
  CUSTOMER_SERVICE: 'bg-teal-100 text-teal-700',
  SUPERVISOR: 'bg-orange-100 text-orange-700',
  MANAGEMENT: 'bg-[#F7F9FC] text-[#667085]',
  DRIVER: 'bg-emerald-100 text-emerald-700',
  CUSTOMER: 'bg-rose-100 text-rose-700',
};

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ name: '', username: '', phone: '', role: 'WAREHOUSE', status: 'ACTIVE', password: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    const res = await fetch(`/api/users?page=${page}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

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
          <h1 className="text-xl font-bold text-[#101828]">Manajemen User</h1>
          <p className="text-sm text-[#667085]">Kelola akun login staff: Warehouse, CS, Supervisor, dan lainnya</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah User</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Terhubung</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Password Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#101828]">{u.name}</div>
                    <div className="font-mono text-xs text-[#667085]">{u.username}{u.phone ? ` · ${u.phone}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[u.role] || 'bg-[#F7F9FC] text-[#667085]'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.driver ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Driver · {u.driver.employeeId}
                      </span>
                    ) : (
                      <span className="text-[#667085]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E4E7EC] text-[#667085]'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{formatDateTime(u.lastPasswordChange)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(u)} className="text-xs font-semibold text-[#0D6EFD] hover:underline">Edit</button>
                    <button onClick={() => remove(u)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={6} text="Belum ada user" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
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
