"use client";

import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';
import { formatDateTime } from '@/lib/constants';
import { Modal, Field, inputCls, btnPrimary, EmptyRow } from '@/components/ui';

type TenantRef = { id: string; slug: string; name: string };

type DemoRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string;
  message: string | null;
  status: string;
  tenantId: string | null;
  provisionedAt: string | null;
  tenant: TenantRef | null;
  createdAt: string;
};

type ProvisionResult = {
  slug: string;
  adminUsername: string;
  adminPassword: string;
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'CONTACTED', label: 'Sudah Dihubungi' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'REJECTED', label: 'Ditolak' },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONTACTED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function DemoRequestsPage() {
  const [items, setItems] = useState<DemoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detail, setDetail] = useState<DemoRow | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingCredentials, setSendingCredentials] = useState(false);
  const [credentialsSent, setCredentialsSent] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set('q', q);
    if (filterStatus) params.set('status', filterStatus);
    const res = await fetch(`/api/demo-requests?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  }, [page, q, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    setProcessing(id);
    try {
      const res = await fetch('/api/demo-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal memperbarui status');
        setProcessing(null);
        return;
      }
      if (data.provisioning) {
        setProvisionResult(data.provisioning);
      }
      if (data.tenant) {
        setDetail(data);
      }
      await load();
    } catch {
      alert('Terjadi kesalahan jaringan');
    }
    setProcessing(null);
  }

  async function remove(id: string) {
    if (!confirm('Hapus data permohonan demo ini?')) return;
    const res = await fetch(`/api/demo-requests?id=${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function copyCredentials() {
    if (!provisionResult || !detail) return;
    const text = `Akun DTMS untuk ${detail.company}:\nURL: ${window.location.origin}\nUsername: ${provisionResult.adminUsername}\nPassword: ${provisionResult.adminPassword}\n\nSilakan login dan ganti password.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendCredentials() {
    if (!provisionResult || !detail?.tenant) return;
    setSendingCredentials(true);
    try {
      const body = `Halo ${detail.name},\n\nAkun DTMS untuk ${detail.company} telah berhasil dibuat.\n\nDetail Akun:\nURL: ${window.location.origin}/login\nUsername: ${provisionResult.adminUsername}\nPassword: ${provisionResult.adminPassword}\n\nSilakan login dan segera ganti password Anda.\n\nTerima kasih.`;
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: detail.tenant.id,
          subject: 'Akun DTMS Anda Telah Aktif',
          body,
          direction: 'OUTBOUND',
        }),
      });
      if (res.ok) {
        setCredentialsSent(true);
      }
    } catch {}
    setSendingCredentials(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#101828]">Permohonan Demo</h1>
        <p className="text-sm text-[#667085]">Kelola permohonan demo dari calon pelanggan</p>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
        <Field label="Cari">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nama, email, atau perusahaan..."
            className={inputCls}
          />
        </Field>
        <Field label="Status">
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className={inputCls}>
            <option value="">Semua</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <button type="submit" className={btnPrimary}>Cari</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3 text-left">Nama / Perusahaan</th>
                <th className="px-4 py-3 text-left">Kontak</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#101828]">{d.name}</div>
                    <div className="text-xs text-[#667085]">{d.company}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-[#101828]">{d.email}</div>
                    <div className="text-xs text-[#667085]">{d.phone || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={d.status}
                      onChange={(e) => updateStatus(d.id, e.target.value)}
                      disabled={processing === d.id || d.status === 'COMPLETED'}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[d.status] || ''}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{formatDateTime(d.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetail(d)} className="text-xs font-semibold text-[#0D6EFD] hover:underline">Detail</button>
                    <button onClick={() => remove(d.id)} className="ml-3 text-xs font-semibold text-red-500 hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <EmptyRow colSpan={5} text="Belum ada permohonan demo" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>

      <Modal open={!!detail} title="Detail Permohonan" onClose={() => { setDetail(null); setProvisionResult(null); }}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[#667085]">Nama</div>
                <div className="font-medium text-[#101828]">{detail.name}</div>
              </div>
              <div>
                <div className="text-xs text-[#667085]">Perusahaan</div>
                <div className="font-medium text-[#101828]">{detail.company}</div>
              </div>
              <div>
                <div className="text-xs text-[#667085]">Email</div>
                <div className="text-[#101828]">{detail.email}</div>
              </div>
              <div>
                <div className="text-xs text-[#667085]">Telepon</div>
                <div className="text-[#101828]">{detail.phone || '-'}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#667085]">Pesan</div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-[#F7F9FC] p-3 text-[#101828]">{detail.message || '-'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[#667085]">Status</div>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[detail.status] || ''}`}>
                  {STATUS_OPTIONS.find((s) => s.value === detail.status)?.label || detail.status}
                </span>
              </div>
              <div>
                <div className="text-xs text-[#667085]">Tanggal</div>
                <div>{formatDateTime(detail.createdAt)}</div>
              </div>
            </div>

            {detail.tenant && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Tenant Aktif</div>
                <div className="text-sm text-emerald-800">{detail.tenant.name}</div>
                <div className="text-xs text-emerald-600">Slug: {detail.tenant.slug} · /login</div>
                {!provisionResult && (
                  <a
                    href={`/komunikasi`}
                    className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Kirim pesan via Komunikasi →
                  </a>
                )}
              </div>
            )}

            {provisionResult && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="text-xs font-semibold text-blue-700">Tenant Berhasil Dibuat</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-blue-600">Username:</span>
                    <div className="font-mono font-bold text-blue-800">{provisionResult.adminUsername}</div>
                  </div>
                  <div>
                    <span className="text-xs text-blue-600">Password:</span>
                    <div className="font-mono font-bold text-blue-800">{provisionResult.adminPassword}</div>
                  </div>
                </div>
                <div className="text-xs text-blue-600">Slug: {provisionResult.slug}</div>
                <div className="flex gap-2">
                  <button
                    onClick={copyCredentials}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    {copied ? 'Tersalin!' : 'Salin Kredensial'}
                  </button>
                  {detail.tenant && (
                    <button
                      onClick={sendCredentials}
                      disabled={sendingCredentials || credentialsSent}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {credentialsSent ? 'Terkirim!' : sendingCredentials ? 'Mengirim...' : 'Kirim ke Tenant'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
              {detail.status !== 'COMPLETED' && (
                <button
                  onClick={async () => { await updateStatus(detail.id, 'COMPLETED'); }}
                  disabled={processing === detail.id}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {processing === detail.id ? 'Memproses...' : 'Setujui & Buat Tenant'}
                </button>
              )}
              {detail.status !== 'COMPLETED' && (
                <button
                  onClick={() => { updateStatus(detail.id, 'REJECTED'); setDetail(null); }}
                  disabled={processing === detail.id}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Tolak
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
