'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, CalendarRange, AlertTriangle, Wallet,
  Percent, UserRound, PackageCheck, Coins,
} from 'lucide-react';

type Dashboard = {
  kpi: {
    mrr: number; arr: number; arpu: number; activeSubscriptions: number;
    receivable: number; overdueAmount: number; overdueCount: number;
    collectionRate: number; currency: string;
  };
  revenueTrend: Array<{ month: string; revenue: number; invoices: number }>;
  statusBreakdown: Array<{ status: string; count: number; amount: number }>;
  topTenants: Array<{ tenantId: string; tenantName: string; tenantCode: string; planCode: string; billed: number; paid: number; invoices: number }>;
};

function rp(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`;
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Jt`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-200',
  ISSUED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SENT: 'bg-sky-50 text-sky-700 border-sky-200',
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  OVERDUE: 'bg-red-50 text-red-700 border-red-200',
  VOID: 'bg-orange-50 text-orange-700 border-orange-200',
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Dibayar', PARTIALLY_PAID: 'Dibayar Sebagian', ISSUED: 'Terbit',
  SENT: 'Terkirim', DRAFT: 'Draft', OVERDUE: 'Jatuh Tempo', VOID: 'Void',
};

export default function DashboardTab() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/superadmin/billing/dashboard')
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setData(await r.json());
      })
      .catch(() => setError('Gagal memuat dashboard billing'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-16 text-center text-sm text-[#667085]">Memuat dashboard…</div>;
  if (error || !data) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  const k = data.kpi;
  const maxRev = Math.max(1, ...data.revenueTrend.map((t) => t.revenue));

  const kpis = [
    { label: 'MRR', value: rp(k.mrr), sub: 'Pendapatan bulanan berulang', icon: Coins, color: 'text-blue-600 bg-blue-50' },
    { label: 'ARR', value: rp(k.arr), sub: 'Proyeksi tahunan', icon: TrendingUp, color: 'text-violet-600 bg-violet-50' },
    { label: 'Piutang (Outstanding)', value: rp(k.receivable), sub: 'Belum dibayar penuh', icon: Wallet, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Overdue', value: rp(k.overdueAmount), sub: `${k.overdueCount} invoice lewat jatuh tempo`, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Collection Rate (90h)', value: `${k.collectionRate}%`, sub: 'Rasio tertagih', icon: Percent, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'ARPU', value: rp(k.arpu), sub: 'Pendapatan per tenant', icon: UserRound, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Langganan Aktif', value: k.activeSubscriptions.toLocaleString('id-ID'), sub: 'Subscription status ACTIVE', icon: PackageCheck, color: 'text-teal-600 bg-teal-50' },
    { label: 'Periode Berjalan', value: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), sub: 'Basis perhitungan MRR', icon: CalendarRange, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[#98a2b3]">{item.label}</span>
                <span className={`rounded-lg p-1.5 ${item.color}`}><Icon size={15} /></span>
              </div>
              <p className="mt-2 text-lg font-bold text-[#101828]">{item.value}</p>
              <p className="mt-0.5 text-xs text-[#667085]">{item.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Revenue trend */}
        <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#101828]">Tren Pendapatan Terbit (6 bulan)</h3>
          {data.revenueTrend.length === 0 ? (
            <p className="mt-8 mb-6 text-center text-sm text-[#98a2b3]">Belum ada invoice terbit.</p>
          ) : (
            <div className="mt-4 flex h-44 items-end gap-3">
              {data.revenueTrend.map((t) => (
                <div key={t.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-[#475467]">{rp(t.revenue)}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#2563eb] to-[#60a5fa]"
                    style={{ height: `${Math.max(4, (t.revenue / maxRev) * 120)}px` }}
                    title={`${t.invoices} invoice`}
                  />
                  <span className="text-[10px] text-[#98a2b3]">{t.month.slice(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoice status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#101828]">Status Invoice</h3>
          <div className="mt-3 space-y-2">
            {data.statusBreakdown.length === 0 && <p className="text-sm text-[#98a2b3]">Belum ada data.</p>}
            {data.statusBreakdown.map((s) => (
              <div key={s.status} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${STATUS_STYLES[s.status] || 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                <span className="font-medium">{STATUS_LABELS[s.status] || s.status}</span>
                <span>{s.count} · {rp(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top tenants */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[#101828]">Tenant Terbesar (berdasarkan nilai tagihan)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-[#98a2b3]">
                <th className="px-5 py-2.5 font-medium">Tenant</th>
                <th className="px-5 py-2.5 font-medium">Kode</th>
                <th className="px-5 py-2.5 font-medium">Plan</th>
                <th className="px-5 py-2.5 text-right font-medium">Ditagihkan</th>
                <th className="px-5 py-2.5 text-right font-medium">Terbayar</th>
                <th className="px-5 py-2.5 text-center font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.topTenants.map((t) => (
                <tr key={t.tenantId} className="hover:bg-gray-50/60">
                  <td className="px-5 py-2.5 font-medium text-[#101828]">{t.tenantName}</td>
                  <td className="px-5 py-2.5 text-[#667085]">{t.tenantCode}</td>
                  <td className="px-5 py-2.5"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-[#475467]">{t.planCode}</span></td>
                  <td className="px-5 py-2.5 text-right font-medium text-[#101828]">Rp {t.billed.toLocaleString('id-ID')}</td>
                  <td className="px-5 py-2.5 text-right text-emerald-700">Rp {t.paid.toLocaleString('id-ID')}</td>
                  <td className="px-5 py-2.5 text-center text-[#667085]">{t.invoices}</td>
                </tr>
              ))}
              {data.topTenants.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-[#98a2b3]">Belum ada tagihan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
