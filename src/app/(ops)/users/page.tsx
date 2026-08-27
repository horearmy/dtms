"use client";

import { useEffect, useState, useCallback } from 'react';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import Pagination from '@/components/Pagination';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/constants';
import { csrfHeaders } from '@/lib/csrf';

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
  tenantId: string | null;
  tenant: { id: string; name: string; slug: string } | null;
  driver: { id: string; employeeId: string; name: string } | null;
};

const ROLE_OPTIONS_ALL: { value: string; label: string }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse / Staff Gudang' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'ADMIN_OPERASIONAL', label: 'Admin Operasional' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];
const ROLE_OPTIONS_TENANT: { value: string; label: string }[] = [
  { value: 'WAREHOUSE', label: 'Warehouse / Staff Gudang' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'ADMIN_OPERASIONAL', label: 'Admin Operasional' },
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
  const [form, setForm] = useState({ name: '', username: '', phone: '', role: 'WAREHOUSE', status: 'ACTIVE', password: '', tenantId: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const [resetModal, setResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<{ password: string; waSent: boolean; waError?: string; message: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [bulkModal, setBulkModal] = useState(false);
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: { row: string; error: string }[] } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', username: '', phone: '', role: 'WAREHOUSE', email: '', tenantId: '' });
  const [inviteResult, setInviteResult] = useState<{ password: string; waSent: boolean; message: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  const ROLE_OPTIONS = isSuperAdmin ? ROLE_OPTIONS_ALL : ROLE_OPTIONS_TENANT;

  const load = useCallback(async () => {
    const res = await fetch(`/api/users?page=${page}&pageSize=${pageSize}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setIsSuperAdmin(data.isSuperAdmin || false);
      if (data.isSuperAdmin) {
        const tRes = await fetch('/api/tenants');
        if (tRes.ok) {
          const raw = await tRes.json();
          const tenantsList = Array.isArray(raw) ? raw : raw.tenants || [];
          setTenants(tenantsList.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
        }
      }
    }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEdit(null);
    setForm({ name: '', username: '', phone: '', role: 'WAREHOUSE', status: 'ACTIVE', password: '', tenantId: '' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(u: UserRow) {
    setEdit(u);
    setForm({ name: u.name, username: u.username, phone: u.phone || '', role: u.role, status: u.status, password: '', tenantId: u.tenantId || '' });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(edit ? `/api/users/${edit.id}` : '/api/users', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
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

  function openResetPassword(u: UserRow) {
    setResetTarget(u);
    setResetResult(null);
    setResetModal(true);
  }
  async function doResetPassword() {
    if (!resetTarget) return;
    setResetLoading(true);
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetResult({ password: '', waSent: false, message: data.error || 'Gagal mereset password', waError: '' });
      } else {
        setResetResult({
          password: data.plainPassword,
          waSent: data.waSent,
          waError: data.waError,
          message: data.message,
        });
        await load();
      }
    } catch {
      setResetResult({ password: '', waSent: false, message: 'Terjadi kesalahan', waError: '' });
    }
    setResetLoading(false);
  }
  function copyPassword() {
    if (resetResult?.password) navigator.clipboard.writeText(resetResult.password);
  }

  async function doBulkImport() {
    if (!bulkCsv.trim()) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: bulkCsv }),
      });
      const data = await res.json();
      setBulkResult(data);
      if (data.created > 0) await load();
    } catch {
      setBulkResult({ created: 0, skipped: 0, errors: [{ row: '-', error: 'Gagal mengimport' }] });
    }
    setBulkLoading(false);
  }

  async function doInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg('');
    setInviteResult(null);
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMsg(data.error || 'Gagal mengundang');
      } else {
        setInviteResult({
          password: data.plainPassword,
          waSent: data.waSent,
          message: data.message,
        });
        await load();
      }
    } catch {
      setInviteMsg('Terjadi kesalahan');
    }
    setInviteLoading(false);
  }
  function copyInvitePassword() {
    if (inviteResult?.password) navigator.clipboard.writeText(inviteResult.password);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Manajemen User</h1>
          <p className="text-sm text-[#667085]">Kelola akun login staff: Warehouse, CS, Supervisor, dan lainnya</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setBulkCsv(''); setBulkResult(null); setBulkModal(true); }} className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm font-semibold text-[#101828] hover:bg-[#F7F9FC]">
            Import CSV
          </button>
          <button onClick={() => { setInviteForm({ name: '', username: '', phone: '', role: 'WAREHOUSE', email: '', tenantId: '' }); setInviteResult(null); setInviteMsg(''); setInviteModal(true); }} className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm font-semibold text-[#101828] hover:bg-[#F7F9FC]">
            Undang User
          </button>
          <button onClick={openNew} className={btnPrimary}>+ Tambah User</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3 text-left">User</th>
                {isSuperAdmin && <th className="px-4 py-3 text-left">Tenant</th>}
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
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-xs text-[#667085]">{u.tenant?.name || '-'}</td>
                  )}
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
                    <button onClick={() => openResetPassword(u)} className="ml-3 text-xs font-semibold text-amber-600 hover:underline">Reset PW</button>
                    <a href={`/users/${u.id}`} className="ml-3 text-xs font-semibold text-[#667085] hover:underline">Aktivitas</a>
                    <button onClick={() => remove(u)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={isSuperAdmin ? 7 : 6} text="Belum ada user" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>

      {/* Modal: Tambah / Edit User */}
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
              <div className="flex gap-1">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputCls}
                  placeholder={edit ? 'kosongkan jika tidak diganti' : 'min. 8 karakter'}
                />
                {!edit && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/users/generate-password');
                        const data = await res.json();
                        setForm({ ...form, password: data.password });
                      } catch { /* ignore */ }
                    }}
                    className="shrink-0 rounded-lg border border-[#E4E7EC] px-2 text-xs font-semibold text-[#0D6EFD] hover:bg-[#F7F9FC]"
                    title="Generate password acak"
                  >
                    Acak
                  </button>
                )}
              </div>
            </Field>
            <Field label="Role" required>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            {isSuperAdmin && (
              <Field label="Tenant">
                <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className={inputCls}>
                  <option value="">— Global (Super Admin) —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            )}
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

      {/* Modal: Reset Password */}
      <Modal open={resetModal} title="Reset Password" onClose={() => setResetModal(false)}>
        {resetResult ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resetResult.message}</div>
            {resetResult.password && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#667085]">Password Baru</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={resetResult.password}
                    className={`${inputCls} font-mono text-sm`}
                  />
                  <button onClick={copyPassword} className="shrink-0 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#0D6EFD] hover:bg-[#F7F9FC]">
                    Salin
                  </button>
                </div>
                <p className="text-xs text-[#667085]">
                  User akan diminta mengganti password saat login berikutnya.
                  {!resetResult.waSent && resetResult.waError && ` WhatsApp gagal: ${resetResult.waError}`}
                </p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={() => setResetModal(false)} className={btnPrimary}>Tutup</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Reset password <strong>{resetTarget?.username}</strong>? Password acak baru akan dibuat{resetTarget?.phone ? ' dan dikirim via WhatsApp.' : '.'}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setResetModal(false)} className={btnGhost}>Batal</button>
              <button onClick={doResetPassword} disabled={resetLoading} className={btnPrimary}>
                {resetLoading ? 'Mereset...' : 'Reset Password'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Bulk Import */}
      <Modal open={bulkModal} title="Import User dari CSV" onClose={() => setBulkModal(false)}>
        <div className="space-y-3">
          <p className="text-sm text-[#667085]">
            Format CSV: <code className="rounded bg-[#F7F9FC] px-1 text-xs">nama,username,role,telepon</code><br />
            Role yang valid: WAREHOUSE, CUSTOMER_SERVICE, SUPERVISOR, MANAGEMENT, DISPATCHER, ADMIN_OPERASIONAL, SUPER_ADMIN
          </p>
          <textarea
            value={bulkCsv}
            onChange={(e) => setBulkCsv(e.target.value)}
            rows={8}
            className={`${inputCls} font-mono text-xs`}
            placeholder={`Budi Santoso,budi,WAREHOUSE,081234567890\nSari Dewi,sari,CUSTOMER_SERVICE,081234567891`}
          />
          {bulkResult && (
            <div className="space-y-2">
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Berhasil dibuat: {bulkResult.created} user
                {bulkResult.skipped > 0 && `, dilewati: ${bulkResult.skipped}`}
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {bulkResult.errors.map((e, i) => (
                    <div key={i}>Baris {e.row}: {e.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setBulkModal(false)} className={btnGhost}>Tutup</button>
            <button onClick={doBulkImport} disabled={bulkLoading || !bulkCsv.trim()} className={btnPrimary}>
              {bulkLoading ? 'Mengimport...' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Invite User */}
      <Modal open={inviteModal} title="Undang User Baru" onClose={() => setInviteModal(false)}>
        {inviteResult ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{inviteResult.message}</div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#667085]">Password Akun</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteResult.password}
                  className={`${inputCls} font-mono text-sm`}
                />
                <button onClick={copyInvitePassword} className="shrink-0 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#0D6EFD] hover:bg-[#F7F9FC]">
                  Salin
                </button>
              </div>
              <p className="text-xs text-[#667085]">
                Kirimkan password ini ke user. User akan diminta mengganti password saat login pertama kali.
                {!inviteResult.waSent && ' WhatsApp tidak terkirim (nomor tidak tersedia atau WA belum dikonfigurasi).'}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setInviteModal(false)} className={btnPrimary}>Tutup</button>
            </div>
          </div>
        ) : (
          <form onSubmit={doInvite} className="space-y-3">
            <p className="text-sm text-[#667085]">Buat akun baru dan kirim password via WhatsApp.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Nama Lengkap" required>
                  <input required value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Username" required>
                <input required value={inviteForm.username} onChange={(e) => setInviteForm({ ...inviteForm, username: e.target.value })} className={inputCls} placeholder="mis. budi_s" />
              </Field>
              <Field label="Nomor WhatsApp" required>
                <input required value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })} className={inputCls} placeholder="081234567890" />
              </Field>
              <Field label="Role" required>
                <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className={inputCls}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              {isSuperAdmin && (
                <Field label="Tenant">
                  <select value={inviteForm.tenantId} onChange={(e) => setInviteForm({ ...inviteForm, tenantId: e.target.value })} className={inputCls}>
                    <option value="">— Global (Super Admin) —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Email (opsional)">
                <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className={inputCls} />
              </Field>
            </div>
            {inviteMsg && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{inviteMsg}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setInviteModal(false)} className={btnGhost}>Batal</button>
              <button type="submit" disabled={inviteLoading} className={btnPrimary}>
                {inviteLoading ? 'Membuat Akun...' : 'Buat Akun & Kirim WA'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
