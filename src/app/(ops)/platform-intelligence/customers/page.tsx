'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Users, UserPlus, UserCheck, UserX, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import ExecutiveInsights from '@/components/platform/ExecutiveInsights';

type CustomerData = {
  period: { from: string; to: string };
  summary: { total: number; newThisPeriod: number; active: number; dormant: number; activityRate: number; growthPct: number };
  byCity: { city: string; count: number }[];
  topSenders: { customerId: string; name: string; shipmentCount: number; totalWeight: number }[];
  topReceivers: { customerId: string; name: string; shipmentCount: number; totalWeight: number }[];
  dormant: { id: string; name: string; createdAt: string }[];
  trend: { month: string; count: number }[];
  insights: { type: string; text: string }[];
};

const CITY_COLORS = ['#0D6EFD', '#16B364', '#7C3AED', '#FF8A00', '#F5222D', '#667085', '#0EA5E9', '#D946EF'];

const PRESETS = [
  { value: 'this_month', label: 'Bulan Ini' }, { value: 'last_30_days', label: '30 Hari' },
  { value: 'last_7_days', label: '7 Hari' }, { value: 'today', label: 'Hari Ini' },
  { value: 'this_quarter', label: 'Kuartal Ini' }, { value: 'this_year', label: 'Tahun Ini' },
];

export default function CustomerAnalyticsPage() {
  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (p: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/platform/reports/customers?preset=${p}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Gagal memuat data');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchData(preset, controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [preset, fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(preset); setRefreshing(false); };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat customer analytics...</p>
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

  const cityData = data.byCity.map((c) => ({ name: c.city, value: c.count }));

  const RADIAN = Math.PI / 180;
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Customer Analytics</h1>
          <p className="text-xs text-[#667085]">Analisis customer, aktivitas, retensi, dan top pengirim/penerima</p>
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
        <KPICard label="Total Customer" value={data.summary.total} icon={<Users size={18} />} color="#0D6EFD" />
        <KPICard label="Baru Periode Ini" value={data.summary.newThisPeriod} changePct={data.summary.growthPct} icon={<UserPlus size={18} />} color="#16B364" />
        <KPICard label="Active" value={data.summary.active} icon={<UserCheck size={18} />} color="#16B364" subtitle={`${data.summary.activityRate}% activity rate`} />
        <KPICard label="Dormant" value={data.summary.dormant} icon={<UserX size={18} />} color="#FF8A00" subtitle="Belum ada shipment" />
        <KPICard label="Activity Rate" value={`${data.summary.activityRate}%`} icon={<TrendingUp size={18} />} color={data.summary.activityRate > 50 ? '#16B364' : '#FF8A00'} />
        <KPICard label="Top Sender" value={data.topSenders[0]?.name || '-'} icon={<Users size={18} />} color="#7C3AED" subtitle={data.topSenders[0] ? `${data.topSenders[0].shipmentCount} shipments` : ''} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customer Growth Trend */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Customer Growth (12 Bulan)</h3>
          {data.trend.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Line type="monotone" dataKey="count" stroke="#0D6EFD" strokeWidth={2} dot={{ r: 3, fill: '#0D6EFD' }} name="Customer Baru" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By City Pie */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Customer per Kota</h3>
          {cityData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data kota</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={cityData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false} label={renderPieLabel}>
                  {cityData.map((_, i) => <Cell key={i} fill={CITY_COLORS[i % CITY_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Senders & Receivers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Senders */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Top Sender (Pengirim)</h3>
          {data.topSenders.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E7EC]">
                    <th className="pb-2 font-semibold text-[#667085]">#</th>
                    <th className="pb-2 font-semibold text-[#667085]">Nama</th>
                    <th className="pb-2 text-right font-semibold text-[#667085]">Shipments</th>
                    <th className="pb-2 text-right font-semibold text-[#667085]">Total Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topSenders.map((s, i) => {
                    const maxCount = data.topSenders[0]?.shipmentCount || 1;
                    return (
                      <tr key={s.customerId} className="border-b border-[#F7F9FC]">
                        <td className="py-2 text-[#667085]">{i + 1}</td>
                        <td className="py-2 font-semibold text-[#101828]">{s.name}</td>
                        <td className="py-2 text-right font-semibold text-[#101828]">{s.shipmentCount}</td>
                        <td className="py-2 text-right text-[#667085]">{s.totalWeight.toFixed(1)} kg</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Receivers */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Top Receiver (Penerima)</h3>
          {data.topReceivers.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E7EC]">
                    <th className="pb-2 font-semibold text-[#667085]">#</th>
                    <th className="pb-2 font-semibold text-[#667085]">Nama</th>
                    <th className="pb-2 text-right font-semibold text-[#667085]">Shipments</th>
                    <th className="pb-2 text-right font-semibold text-[#667085]">Total Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topReceivers.map((r, i) => (
                    <tr key={r.customerId} className="border-b border-[#F7F9FC]">
                      <td className="py-2 text-[#667085]">{i + 1}</td>
                      <td className="py-2 font-semibold text-[#101828]">{r.name}</td>
                      <td className="py-2 text-right font-semibold text-[#101828]">{r.shipmentCount}</td>
                      <td className="py-2 text-right text-[#667085]">{r.totalWeight.toFixed(1)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dormant Customers */}
      {data.dormant.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <UserX size={16} className="text-[#FF8A00]" />
            <h3 className="text-sm font-bold text-[#101828]">Dormant Customers (Belum Ada Shipment)</h3>
            <span className="rounded-full bg-[#FF8A00] px-2 py-0.5 text-[10px] font-bold text-white">{data.dormant.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Nama</th>
                  <th className="pb-2 font-semibold text-[#667085]">Terdaftar Sejak</th>
                </tr>
              </thead>
              <tbody>
                {data.dormant.map((c) => (
                  <tr key={c.id} className="border-b border-[#F7F9FC]">
                    <td className="py-2 font-semibold text-[#101828]">{c.name}</td>
                    <td className="py-2 text-[#667085]">{new Date(c.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* City Distribution Bar */}
      {data.byCity.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Distribusi per Kota</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, data.byCity.length * 28)}>
            <BarChart data={data.byCity.map((c) => ({ name: c.city, count: c.count }))} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#667085' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} width={75} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.byCity.map((_, i) => <Cell key={i} fill={CITY_COLORS[i % CITY_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights */}
      <ExecutiveInsights insights={data.insights} />
    </div>
  );
}
