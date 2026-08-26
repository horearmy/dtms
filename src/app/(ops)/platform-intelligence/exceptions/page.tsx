'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { AlertTriangle, ShieldAlert, Clock, CheckCircle2, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import ExecutiveInsights from '@/components/platform/ExecutiveInsights';
import DrillDownModal, { DrillDownData } from '@/components/platform/DrillDownModal';

type ExceptionData = {
  period: { from: string; to: string };
  summary: {
    total: number; totalAllTime: number; open: number; resolved: number;
    resolutionRate: number; severityIndex: number;
    avgResolutionTime: string; medianResolutionTime: string; p95ResolutionTime: string;
  };
  byStatus: { status: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byType: { type: string; count: number }[];
  byTenant: { tenantId: string; tenantName: string; count: number }[];
  aging: { id: string; title: string; type: string; severity: string; status: string; createdAt: string; dueAt: string | null; tenantName: string; daysOpen: number }[];
  trend: { date: string; count: number }[];
  insights: { type: string; text: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#F5222D', ASSIGNED: '#FF8A00', INVESTIGATING: '#0D6EFD', ACTION_REQUIRED: '#7C3AED',
  RESOLVED: '#16B364', VERIFIED: '#16B364', CLOSED: '#667085', CANCELLED: '#667085',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#F5222D', HIGH: '#FF8A00', MEDIUM: '#0D6EFD', LOW: '#667085',
};

const TYPE_LABELS: Record<string, string> = {
  DELIVERY_FAILED: 'Gagal Kirim', ADDRESS_UNREACHABLE: 'Alamat Tidak Terjangkau',
  CUSTOMER_UNAVAILABLE: 'Customer Tidak Ada', DAMAGED_GOODS: 'Barang Rusak',
  LOST_PACKAGE: 'Paket Hilang', SLA_BREACH: 'SLA Breach', VEHICLE_BREAKDOWN: 'Kendaraan Rusak',
  DRIVER_ISSUE: 'Masalah Driver', ROUTE_DEVIATION: 'Rute Menyimpang', WEATHER: 'Cuaca', OTHER: 'Lainnya',
};

const PRESETS = [
  { value: 'this_month', label: 'Bulan Ini' }, { value: 'last_30_days', label: '30 Hari' },
  { value: 'last_7_days', label: '7 Hari' }, { value: 'today', label: 'Hari Ini' },
  { value: 'this_quarter', label: 'Kuartal Ini' }, { value: 'this_year', label: 'Tahun Ini' },
];

export default function ExceptionAnalyticsPage() {
  const [data, setData] = useState<ExceptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [refreshing, setRefreshing] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const openDrillDown = async (type: string, params?: Record<string, string>) => {
    setDrillLoading(true);
    try {
      const qs = new URLSearchParams({ type, ...params }).toString();
      const res = await fetch(`/api/platform/reports/drilldown?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDrillDown(await res.json());
    } catch { setDrillDown(null); } finally { setDrillLoading(false); }
  };

  const fetchData = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/platform/reports/exceptions?preset=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) { setError(e.message || 'Gagal memuat data'); }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(preset).finally(() => setLoading(false));
  }, [preset, fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(preset); setRefreshing(false); };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat exception analytics...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-[#FEE4E2] bg-[#FEF3F2] p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 text-[#F5222D]" size={32} />
          <p className="text-sm font-semibold text-[#F5222D]">{error}</p>
          <button onClick={() => fetchData(preset)} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">Coba Lagi</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statusData = data.byStatus.map((s) => ({ name: s.status.replace(/_/g, ' '), value: s.count, fill: STATUS_COLORS[s.status] || '#667085' }));
  const severityData = data.bySeverity.map((s) => ({ name: s.severity, value: s.count, fill: SEVERITY_COLORS[s.severity] || '#667085' }));
  const typeData = data.byType.filter((t) => t.count > 0).map((t) => ({ name: TYPE_LABELS[t.type] || t.type, value: t.count }));

  const sevWeight: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const highestSeverity = data.bySeverity.reduce((max, s) => (sevWeight[s.severity] || 0) > (sevWeight[max] || 0) ? s.severity : max, 'LOW');

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Exception Analytics</h1>
          <p className="text-xs text-[#667085]">Analisis root cause, resolution time, dan severity exceptions</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={preset} onChange={(e) => setPreset(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#0D6EFD] focus:outline-none">
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button onClick={handleRefresh} disabled={refreshing}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC] disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Total Exceptions" value={data.summary.total} icon={<AlertTriangle size={18} />} color="#F5222D" subtitle={`${data.summary.totalAllTime} all time`} />
        <button onClick={() => openDrillDown('exceptions_open')} className="text-left">
          <KPICard label="Open" value={data.summary.open} icon={<AlertCircle size={18} />} color="#FF8A00" />
        </button>
        <KPICard label="Resolution Rate" value={`${data.summary.resolutionRate}%`} icon={<CheckCircle2 size={18} />} color="#16B364" />
        <KPICard label="Severity Index" value={`${data.summary.severityIndex}/100`} icon={<ShieldAlert size={18} />} color={data.summary.severityIndex > 60 ? '#F5222D' : '#0D6EFD'} subtitle={`Peak: ${highestSeverity}`} />
        <KPICard label="Avg Resolution" value={data.summary.avgResolutionTime} icon={<Clock size={18} />} color="#7C3AED" subtitle={`Median: ${data.summary.medianResolutionTime}`} />
        <KPICard label="P95 Resolution" value={data.summary.p95ResolutionTime} icon={<TrendingUp size={18} />} color="#0D6EFD" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trend Line */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Exception Trend</h3>
          {data.trend.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Line type="monotone" dataKey="count" stroke="#F5222D" strokeWidth={2} dot={{ r: 3, fill: '#F5222D' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Type Bar */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Exception per Tipe</h3>
          {typeData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={typeData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} width={120} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By Severity */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Exception per Severity</h3>
          {severityData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                    if (percent < 0.05) return null;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
                  }}>
                  {severityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Status */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Exception per Status</h3>
          {statusData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#667085' }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Tenants Table */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h3 className="mb-4 text-sm font-bold text-[#101828]">Top Tenant by Exception Count</h3>
        {data.byTenant.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#667085]">Tidak ada data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Tenant</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Count</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">% of Total</th>
                  <th className="pb-2 font-semibold text-[#667085]">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {data.byTenant.map((t) => (
                  <tr key={t.tenantId} className="border-b border-[#F7F9FC]">
                    <td className="py-2 font-semibold text-[#101828]">{t.tenantName}</td>
                    <td className="py-2 text-right font-semibold text-[#101828]">{t.count}</td>
                    <td className="py-2 text-right text-[#667085]">{data.summary.total > 0 ? ((t.count / data.summary.total) * 100).toFixed(1) : 0}%</td>
                    <td className="py-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                        <div className="h-full rounded-full bg-[#0D6EFD]" style={{ width: `${data.summary.total > 0 ? (t.count / data.summary.total) * 100 : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aging Exceptions */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={16} className="text-[#F5222D]" />
          <h3 className="text-sm font-bold text-[#101828]">Aging Exceptions (Overdue / Open &gt; 7 Hari)</h3>
          {data.aging.length > 0 && (
            <span className="rounded-full bg-[#F5222D] px-2 py-0.5 text-[10px] font-bold text-white">{data.aging.length}</span>
          )}
        </div>
        {data.aging.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#16B364]">
            <CheckCircle2 size={16} /> Tidak ada exception aging. Semua dalam batas normal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Title</th>
                  <th className="pb-2 font-semibold text-[#667085]">Type</th>
                  <th className="pb-2 font-semibold text-[#667085]">Severity</th>
                  <th className="pb-2 font-semibold text-[#667085]">Status</th>
                  <th className="pb-2 font-semibold text-[#667085]">Tenant</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Hari Open</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.aging.map((e) => {
                  const sevColor = SEVERITY_COLORS[e.severity] || '#667085';
                  const isOverdue = e.dueAt && new Date(e.dueAt) < new Date();
                  return (
                    <tr key={e.id} className="border-b border-[#F7F9FC]">
                      <td className="max-w-[200px] truncate py-2 font-semibold text-[#101828]">{e.title}</td>
                      <td className="py-2 text-[#667085]">{TYPE_LABELS[e.type] || e.type}</td>
                      <td className="py-2">
                        <span className="inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase text-white" style={{ backgroundColor: sevColor }}>{e.severity}</span>
                      </td>
                      <td className="py-2 text-[#667085]">{e.status.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-[#667085]">{e.tenantName}</td>
                      <td className={`py-2 text-right font-bold ${e.daysOpen > 14 ? 'text-[#F5222D]' : e.daysOpen > 7 ? 'text-[#FF8A00]' : 'text-[#101828]'}`}>{e.daysOpen}</td>
                      <td className="py-2 text-right">
                        {e.dueAt ? (
                          <span className={isOverdue ? 'font-bold text-[#F5222D]' : 'text-[#667085]'}>
                            {new Date(e.dueAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Insights */}
      <ExecutiveInsights insights={data.insights} />

      {/* Drill Down Modal */}
      {drillLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white px-6 py-4 shadow-2xl">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
            <p className="text-xs text-[#667085]">Memuat data...</p>
          </div>
        </div>
      )}
      <DrillDownModal data={drillDown} onClose={() => setDrillDown(null)} />
    </div>
  );
}
