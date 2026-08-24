'use client';

import { useCallback, useEffect, useState } from 'react';
import { Handshake, Plus, RefreshCcw } from 'lucide-react';
import { Modal } from './InvoicesTab';
import { PLAN_ORDER as PLAN_CODES } from '@/lib/plan-constants';

type Contract = {
  id: string; contractNumber: string; planCode: string | null; billingCycle: string;
  startDate: string; endDate: string | null; paymentTermsDays: number; autoRenew: boolean;
  creditLimit: number; gracePeriodDays: number; status: string;
  tenant: { name: string; code: string | null };
};

type TenantOpt = { id: string; name: string; code: string | null; slug: string };

const CYCLES = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];

export default function ContractsTab() {
  const [rows, setRows] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/superadmin/billing/contracts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.contracts || []);
        setTotal(data.total || 0);
      } else setRows([]);
    } catch { setRows([]); }
    setLoading(false);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  function fmtDate(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor kontrak / tenant…"
          className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-[#98a2b3]" />
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCcw size={14} /> Muat ulang
        </button>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-[#101828] px-3.5 py-2 text-sm font-medium text-white hover:bg-black">
          <Plus size={14} /> Kontrak Baru
        </button>
        <span className="text-xs text-[#667085]">{total.toLocaleString('id-ID')} kontrak</span>
      </div>

      {msg && <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-[#98a2b3]">
                <th className="px-5 py-3 font-medium">No. Kontrak</th>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Siklus</th>
                <th className="px-4 py-3 font-medium">Periode</th>
                <th className="px-4 py-3 text-center font-medium">Termin</th>
                <th className="px-4 py-3 text-center font-medium">Auto Renew</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[#98a2b3]">Memuat…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-[#98a2b3]">Belum ada kontrak.</td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-3 font-mono text-xs font-medium text-[#101828]">{c.contractNumber}</td>
                  <td className="px-4 py-3 font-medium text-[#101828]">{c.tenant.name}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[#475467]">{c.planCode || '-'}</span></td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{c.billingCycle.replaceAll('_', '-')}</td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</td>
                  <td className="px-4 py-3 text-center text-xs text-[#667085]">{c.paymentTermsDays}h / grace {c.gracePeriodDays}h</td>
                  <td className="px-4 py-3 text-center text-xs">{c.autoRenew ? <span className="text-emerald-600">Ya</span> : <span className="text-[#98a2b3]">Tidak</span>}</td>
                  <td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <ContractModal onClose={() => setShowForm(false)}
        onDone={(ok, text) => { setShowForm(false); setMsg({ ok, text }); load(); }} />}
    </div>
  );
}

function ContractModal({ onClose, onDone }: { onClose: () => void; onDone: (ok: boolean, text: string) => void }) {
  const [tenantQ, setTenantQ] = useState('');
  const [opts, setOpts] = useState<TenantOpt[]>([]);
  const [picked, setPicked] = useState<TenantOpt | null>(null);
  const [planCode, setPlanCode] = useState('STARTER');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [paymentTermsDays, setPaymentTermsDays] = useState('14');
  const [gracePeriodDays, setGracePeriodDays] = useState('14');
  const [creditLimit, setCreditLimit] = useState('0');
  const [autoRenew, setAutoRenew] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tenantQ.trim().length < 2) { setOpts([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenants?search=${encodeURIComponent(tenantQ.trim())}&pageSize=10`);
        if (res.ok) setOpts(((await res.json()).tenants || []).map((x: TenantOpt & Record<string, unknown>) => ({ id: x.id, name: x.name, code: x.code as string | null, slug: x.slug })));
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, [tenantQ]);

  async function submit() {
    if (!picked) return;
    setBusy(true);
    try {
      const res = await fetch('/api/superadmin/billing/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: picked.id, planCode, billingCycle,
          paymentTermsDays: Number(paymentTermsDays), gracePeriodDays: Number(gracePeriodDays),
          creditLimit: Number(creditLimit), autoRenew, startDate,
          endDate: endDate || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) onDone(false, data.error || 'Gagal membuat kontrak');
      else onDone(true, `Kontrak ${data.contract?.contractNumber} dibuat untuk ${picked.name}`);
    } catch { onDone(false, 'Kesalahan jaringan'); }
    setBusy(false);
  }

  return (
    <Modal title={<span className="flex items-center gap-2"><Handshake size={16} /> Kontrak Baru</span>} onClose={onClose}>
      <div className="space-y-3 text-sm">
        {picked ? (
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-sm font-medium text-blue-800">{picked.name} <span className="text-xs text-blue-500">({picked.code || picked.slug})</span></span>
            <button onClick={() => { setPicked(null); setTenantQ(''); }} className="text-xs text-blue-600 underline">ubah</button>
          </div>
        ) : (
          <label className="block relative">
            <span className="text-xs font-medium text-[#344054]">Cari tenant (min. 2 huruf)</span>
            <input value={tenantQ} onChange={(e) => setTenantQ(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            {opts.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {opts.map((o) => (
                  <button key={o.id} onClick={() => { setPicked(o); setOpts([]); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {o.name} <span className="text-xs text-[#98a2b3]">{o.code || o.slug}</span>
                  </button>
                ))}
              </div>
            )}
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Plan</span>
            <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {PLAN_CODES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Siklus Tagihan</span>
            <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              {CYCLES.map((c) => <option key={c} value={c}>{c.replaceAll('_', '-')}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Mulai</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Berakhir (opsional)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Termin Bayar (hari)</span>
            <input type="number" min={0} max={90} value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Grace Period (hari)</span>
            <input type="number" min={0} max={60} value={gracePeriodDays} onChange={(e) => setGracePeriodDays(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-[#344054]">Credit Limit (Rp)</span>
            <input type="number" min={0} value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="size-4" />
            <span className="text-xs font-medium text-[#344054]">Auto renew</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-[#344054]">Batal</button>
          <button disabled={busy || !picked} onClick={submit}
            className="rounded-lg bg-[#101828] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
            Buat Kontrak
          </button>
        </div>
      </div>
    </Modal>
  );
}
