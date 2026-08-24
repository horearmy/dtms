'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';

type Run = {
  id: string; periodKey: string; runType: string; status: string;
  startedAt: string | null; completedAt: string | null;
  totalTenants: number; totalInvoices: number; totalAmount: number; errorCount: number; triggeredBy: string | null;
};

type RunResult = {
  runId: string; periodKey: string; status: string;
  totalTenants: number; totalInvoices: number; totalAmount: number; errorCount: number;
  skippedExisting?: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 ring-amber-200',
  RUNNING: 'bg-blue-50 text-blue-700 ring-blue-200',
  PENDING: 'bg-gray-100 text-gray-600 ring-gray-200',
  FAILED: 'bg-red-50 text-red-700 ring-red-200',
};

function nowMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default function RunsTab() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');
  const init = nowMonth();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/billing/runs');
      if (res.ok) setRuns((await res.json()).runs || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function execute() {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/superadmin/billing/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Billing run gagal');
      else setResult(data.result);
    } catch { setError('Kesalahan jaringan'); }
    setBusy(false);
    load();
  }

  function fmt(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {/* Jalankan run */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[#101828]">Jalankan Billing Run</h3>
        <p className="mt-1 text-xs text-[#667085]">
          Menghasilkan invoice bulanan untuk seluruh langganan aktif. Idempotent — menjalankan ulang periode yang sama
          tidak akan membuat invoice duplikat.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-[#344054]">
            Bulan
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="ml-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{new Date(2026, m - 1, 1).toLocaleDateString('id-ID', { month: 'long' })}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[#344054]">
            Tahun
            <input type="number" min={2024} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="ml-2 w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <button disabled={busy} onClick={execute}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            <PlayCircle size={15} /> {busy ? 'Memproses…' : 'Jalankan'}
          </button>
        </div>

        {result && (
          <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${result.skippedExisting ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'}`}>
            {result.skippedExisting ? (
              <>Periode <b>{result.periodKey}</b> sudah selesai dijalankan sebelumnya ({result.totalInvoices} invoice, Rp {result.totalAmount.toLocaleString('id-ID')}). Tidak ada duplikat dibuat.</>
            ) : (
              <>
                Billing run <b>{result.periodKey}</b> {result.status === 'PARTIAL' ? 'selesai dengan error parsial' : 'selesai'}:
                {' '}{result.totalInvoices.toLocaleString('id-ID')} invoice dibuat untuk {result.totalTenants.toLocaleString('id-ID')} tenant,
                total <b>Rp {result.totalAmount.toLocaleString('id-ID')}</b>{result.errorCount > 0 ? `, ${result.errorCount} error` : ''}.
              </>
            )}
          </div>
        )}
        {error && <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>

      {/* Riwayat */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[#101828]">Riwayat Billing Run</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-[#98a2b3]">
                <th className="px-5 py-2.5 font-medium">Periode</th>
                <th className="px-4 py-2.5 font-medium">Tipe</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Tenant</th>
                <th className="px-4 py-2.5 text-right font-medium">Invoice</th>
                <th className="px-4 py-2.5 text-right font-medium">Nilai</th>
                <th className="px-4 py-2.5 font-medium">Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={7} className="px-5 py-6 text-center text-sm text-[#98a2b3]">Memuat…</td></tr>}
              {!loading && runs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-6 text-center text-sm text-[#98a2b3]">Belum ada billing run.</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-2.5 font-semibold text-[#101828]">{r.periodKey}</td>
                  <td className="px-4 py-2.5 text-xs text-[#667085]">{r.runType}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{r.status}</span>
                    {r.errorCount > 0 && <span className="ml-1 text-xs text-red-600">({r.errorCount} err)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.totalTenants.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{r.totalInvoices.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-right">Rp {Math.round(r.totalAmount).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-2.5 text-xs text-[#667085]">{fmt(r.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
