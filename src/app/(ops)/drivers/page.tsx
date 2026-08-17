"use client";

import { useEffect, useState, useCallback } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import PhotoField from '@/components/PhotoField';
import DriverDetailModal from '@/components/DriverDetailModal';
import Pagination from '@/components/Pagination';
import { formatDate } from '@/lib/constants';

type Driver = {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  photo?: string | null;
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Driver | null>(null);
  const [form, setForm] = useState({ employeeId: '', name: '', phone: '', photo: null as string | null, status: 'ACTIVE', username: '', password: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    const res = await fetch(`/api/drivers?page=${page}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEdit(null);
    setForm({ employeeId: '', name: '', phone: '', photo: null, status: 'ACTIVE', username: '', password: '' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(d: Driver) {
    setEdit(d);
    setForm({
      employeeId: d.employeeId,
      name: d.name,
      phone: d.phone,
      photo: d.photo || null,
      status: d.status,
      username: d.user?.username || '',
      password: '',
    });
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
          <h1 className="text-xl font-bold text-[#101828]">Drivers</h1>
          <p className="text-sm text-[#667085]">Manajemen kurir & aset kendaraan</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Driver</button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
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
                <tr key={d.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 font-mono text-xs text-[#667085]">{d.employeeId}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {d.photo ? (
                        <img src={d.photo} alt={d.name} className="h-9 w-9 rounded-full border border-[#E4E7EC] object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F0FF] text-xs font-bold text-[#0D6EFD]">
                          {d.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <button onClick={() => setDetailId(d.id)} className="font-medium text-[#101828] hover:text-[#0D6EFD] hover:underline">
                        {d.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{d.phone}</td>
                  <td className="px-4 py-3">
  {d.user ? (
    <span className="font-mono text-xs text-[#667085]">{d.user.username}</span>
  ) : (
    <span className="rounded-full bg-[#FEF0F0] px-2 py-0.5 text-[11px] font-semibold text-[#F5222D]">Belum ada akun</span>
  )}
</td>
                  <td className="px-4 py-3 text-[#667085]">{d._count?.assignments || 0}</td>
                  <td className="px-4 py-3">
                    {d.returning ? (
                      <span className="rounded-full bg-[#FFF7E6] px-2 py-0.5 text-xs font-semibold text-[#FF8A00]">
                        Kembali ke Gudang
                      </span>
                    ) : d.busy ? (
                      <span className="rounded-full bg-[#FFF2E0] px-2 py-0.5 text-xs font-semibold text-[#FF8A00]">
                        Perjalanan{d.activeTracking ? ` · ${d.activeTracking}` : ''}
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === 'ACTIVE' ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-[#F7F9FC] text-[#667085]'}`}>
                        {d.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetailId(d.id)} className="text-xs font-semibold text-[#667085] hover:text-[#0D6EFD] hover:underline">
                      🗺️ Detail
                    </button>
                    <button onClick={() => openEdit(d)} className="ml-3 text-xs font-semibold text-[#0D6EFD] hover:underline">Edit</button>
                    <button onClick={() => remove(d)} className="ml-3 text-xs font-semibold text-[#F5222D] hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={7} text="Belum ada driver" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>

      <Modal open={open} title={edit ? 'Edit Driver' : 'Tambah Driver'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <Field label="Employee ID" required>
                  <input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className={inputCls} placeholder="DRV-XXX" />
                </Field>
                <Field label="Nama" required>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <div>
                <PhotoField label="Foto Driver" value={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
              </div>
            </div>
            <Field label="Telepon" required>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </Field>
            <div className="col-span-2 rounded-lg border border-[#E4E7EC] bg-[#F7F9FC] p-3">
              <p className="mb-2 text-[11px] font-bold uppercase text-[#667085]">Akun Login Driver</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={edit && edit.user ? 'Username (login)' : 'Username Akun'}>
                  {edit && edit.user ? (
                    <input value={form.username} readOnly className={inputCls + ' bg-[#F7F9FC] text-[#667085]'} />
                  ) : (
                    <input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className={inputCls}
                      placeholder={edit ? 'ketik utk buat akun' : 'mis. driver3'}
                    />
                  )}
                </Field>
                <Field label={edit && edit.user ? 'Password Baru' : edit ? 'Password (buat akun)' : 'Password Akun'}>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={inputCls}
                    placeholder={edit && edit.user ? 'kosongkan jika tidak diganti' : 'min. 8 karakter'}
                  />
                </Field>
              </div>
              <p className="mt-2 text-[11px] text-[#667085]">
                {edit && edit.user
                  ? 'Isi Password Baru untuk mereset password login driver.'
                  : 'Isi Username & Password untuk membuat akun login role Driver. Kosongkan bila akun dibuat nanti.'}
              </p>
            </div>
          </div>
          {msg && <div className="rounded-lg bg-[#FEF0F0] px-3 py-2 text-sm text-[#F5222D]">{msg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <DriverDetailModal driverId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
