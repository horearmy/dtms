'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, FileWarning, RefreshCcw, Send } from 'lucide-react';

type InvRow = {
  id: string; invoiceNumber: string; status: string;
  subtotal: number; discountAmount: number; tax: number; total: number; paidAmount: number; outstanding: number;
  currency: string; dueDate: string; issuedAt: string | null; periodKey: string; createdAt: string;
  tenant: { id: string; name: string; code: string | null; plan: string };
};

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 ring-blue-200',
  ISSUED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  SENT: 'bg-sky-50 text-sky-700 ring-sky-200',
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200',
  VOID: 'bg-orange-50 text-orange-700 ring-orange-200',
};
const STATUS_LABELS: Record<string, string> = {
  PAID: 'Dibayar', PARTIALLY_PAID: 'Sebagian', ISSUED: 'Terbit', SENT: 'Terkirim', DRAFT: 'Draft', VOID: 'Void',
};

const METHODS = ['BANK_TRANSFER', 'VIRTUAL_ACCOUNT', 'CREDIT_CARD', 'DEBIT_CARD', 'E_WALLET', 'PAYMENT_GATEWAY', 'CASH', 'OTHER'];

export default function InvoicesTab() {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [payFor, setPayFor] = useState<InvRow | null>(null);
  const [voidFor, setVoidFor] = useState<InvRow | null>(null);
  const [busy, setBusy] = useState(false);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/superadmin/billing/invoices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.invoices || []);
        setTotal(data.total || 0);
      } else setRows([]);
    } catch { setRows([]); }
    setLoading(false);
  }, [page, status, q]);

  useEffect(() => { load(); }, [load]);

  async function act(url: string, method: string, body: unknown) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error || 'Gagal memproses' });
      else {
        setMsg({ ok: true, text: data.message || 'Berhasil' });
        setPayFor(null); setVoidFor(null);
        load();
      }
    } catch { setMsg({ ok: false, text: 'Kesalahan jaringan' }); }
    setBusy(false);
  }

  function fmtDate(s: string | null) {
    if (!s) return '-';
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#344054]">
          <option value="ALL">Semua status</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Terbit</option>
          <option value="PARTIALLY_PAID">Dibayar sebagian</option>
          <option value="PAID">Dibayar</option>
          <option value="VOID">Void</option>
        </select>
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Cari nomor invoice / tenant / kode…"
          className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-[#344054] placeholder:text-[#98a2b3]"
        />
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#344054] hover:bg-gray-50">
          <RefreshCcw size={14} /> Muat ulang
        </button>
        <span className="text-xs text-[#667085]">{total.toLocaleString('id-ID')} invoice</span>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-[#98a2b3]">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Periode</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[#98a2b3]">Memuat…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[#98a2b3]">Tidak ada invoice.</td></tr>}
              {!loading && rows.map((r) => {
                const overdue = r.status !== 'PAID' && r.status !== 'VOID' && new Date(r.dueDate) < new Date() && r.outstanding > 0;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-[#101828]">{r.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#101828]">{r.tenant.name}</p>
                      <p className="text-xs text-[#98a2b3]">{r.tenant.code || r.tenant.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#667085]">{r.periodKey || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#101828]">Rp {r.total.toLocaleString('id-ID')}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Rp {r.outstanding.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-xs text-[#667085]">{fmtDate(r.dueDate)}{overdue && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">LEWAT</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.status === 'DRAFT' && (
                          <button disabled={busy} onClick={() => act(`/api/superadmin/billing/invoices/${r.id}`, 'PATCH', { action: 'ISSUE' })}
                            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                            <Send size={12} /> Terbitkan
                          </button>
                        )}
                        {(r.status === 'ISSUED' || r.status === 'SENT' || r.status === 'PARTIALLY_PAID') && (
                          <>
                            <button disabled={busy} onClick={() => setPayFor(r)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                              <Banknote size={12} /> Bayar
                            </button>
                            <button disabled={busy} onClick={() => setVoidFor(r)}
                              className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                              <FileWarning size={12} /> Void
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
            <span className="text-xs text-[#667085]">Halaman {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-[#344054] disabled:opacity-40">Sebelumnya</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-[#344054] disabled:opacity-40">Berikutnya</button>
            </div>
          </div>
        )}
      </div>

      {payFor && <PayModal inv={payFor} busy={busy} onClose={() => setPayFor(null)} onSubmit={(amount, method, reference) => act('/api/superadmin/billing/payments', 'POST', { invoiceId: payFor.id, amount, method, reference })} />}
      {voidFor && (
        <VoidModal inv={voidFor} busy={busy} onClose={() => setVoidFor(null)}
          onSubmit={(reason) => act(`/api/superadmin/billing/invoices/${voidFor.id}`, 'PATCH', { action: 'VOID', reason })} />
      )}
    </div>
  );
}

function PayModal({ inv, busy, onClose, onSubmit }: {
  inv: InvRow; busy: boolean; onClose: () => void;
  onSubmit: (amount: number, method: string, reference?: string) => void;
}) {
  const [amount, setAmount] = useState(String(inv.outstanding));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  return (
    <Modal title={`Catat Pembayaran — ${inv.invoiceNumber}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-[#475467]">
          Total Rp {inv.total.toLocaleString('id-ID')} · Sudah dibayar Rp {inv.paidAmount.toLocaleString('id-ID')} · Outstanding <b>Rp {inv.outstanding.toLocaleString('id-ID')}</b>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-[#344054]">Nominal (Rp)</span>
          <input type="number" min={1} max={inv.outstanding} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#344054]">Metode</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
            {METHODS.map((m) => <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#344054]">Referensi (opsional, harus unik)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="mis. TRF-20260824-001"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-[#344054]">Batal</button>
          <button disabled={busy || !Number(amount)} onClick={() => onSubmit(Number(amount), method, reference || undefined)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            Simpan Pembayaran
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VoidModal({ inv, busy, onClose, onSubmit }: {
  inv: InvRow; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Void Invoice — ${inv.invoiceNumber}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Invoice tidak dihapus fisik (audit tetap tersimpan). Status akan menjadi VOID dan tidak dapat dibayar.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-[#344054]">Alasan void (wajib)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="mis. Salah input tagihan, diganti invoice baru"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-[#344054]">Batal</button>
          <button disabled={busy || reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            Void Invoice
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: React.ReactNode; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-[#101828]">{title}</h3>
        {children}
      </div>
    </div>
  );
}
