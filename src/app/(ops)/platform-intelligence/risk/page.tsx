'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { AlertTriangle, ShieldAlert, TrendingDown, RefreshCw, Activity, CheckCircle2 } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import DrillDownModal, { DrillDownData } from '@/components/platform/DrillDownModal';

type RiskFactor = { category: string; score: number; label: string; detail: string };
type TenantRisk = {
  tenantId: string; tenantName: string; plan: string; overallScore: number;
  riskLevel: string; factors: RiskFactor[]; recommendation: string;
};
type RiskData = {
  risks: TenantRisk[];
  summary: { total: number; critical: number; high: number; medium: number; low: number; minimal: number };
  riskColor: Record<string, string>;
};

const LEVEL_COLORS: Record<string, string> = { CRITICAL: '#F5222D', HIGH: '#FF8A00', MEDIUM: '#0D6EFD', LOW: '#16B364', MINIMAL: '#667085' };

export default function RiskDetectionPage() {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/platform/reports/risk', { signal });
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
    fetchData(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const openDrillDown = async (type: string, params?: Record<string, string>) => {
    setDrillLoading(true);
    try {
      const qs = new URLSearchParams({ type, ...params }).toString();
      const res = await fetch(`/api/platform/reports/drilldown?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDrillDown(await res.json());
    } catch { setDrillDown(null); } finally { setDrillLoading(false); }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat risk analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-[#F5222D]" />
          <p className="text-sm font-semibold text-[#F5222D]">{error}</p>
          <button onClick={handleRefresh} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pieData = [
    { name: 'Critical', value: data.summary.critical },
    { name: 'High', value: data.summary.high },
    { name: 'Medium', value: data.summary.medium },
    { name: 'Low', value: data.summary.low },
    { name: 'Minimal', value: data.summary.minimal },
  ].filter((d) => d.value > 0);

  const barData = data.risks.slice(0, 15).map((r) => ({ name: r.tenantName.length > 15 ? r.tenantName.slice(0, 15) + '...' : r.tenantName, score: r.overallScore, fill: LEVEL_COLORS[r.riskLevel] }));

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101828]">Tenant Risk Detection</h1>
          <p className="text-xs text-[#667085]">Analisis risiko tenant berdasarkan operasional, billing, SLA, dan usage</p>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]"
          disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button onClick={() => openDrillDown('tenants')} className="text-left">
          <KPICard label="Total Tenant" value={data.summary.total} icon={<Activity size={18} />} color="#0D6EFD" />
        </button>
        <KPICard label="Critical" value={data.summary.critical} icon={<ShieldAlert size={18} />} color="#F5222D" />
        <KPICard label="High Risk" value={data.summary.high} icon={<AlertTriangle size={18} />} color="#FF8A00" />
        <KPICard label="Medium" value={data.summary.medium} icon={<TrendingDown size={18} />} color="#0D6EFD" />
        <KPICard label="Low / Minimal" value={data.summary.low + data.summary.minimal} icon={<CheckCircle2 size={18} />} color="#16B364" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-[#101828]">Risk Score Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F7F9FC" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#667085' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} width={120} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-[#101828]">Risk Level Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine>
                {pieData.map((d, i) => <Cell key={i} fill={LEVEL_COLORS[d.name.toUpperCase()] || '#667085'} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tenant Risk List */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-[#101828]">Tenant Risk Detail</h3>
        <div className="space-y-2">
          {data.risks.length === 0 && (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data tenant</p>
          )}
          {data.risks.map((r) => {
            const isOpen = expanded === r.tenantId;
            const color = LEVEL_COLORS[r.riskLevel];
            return (
              <div key={r.tenantId} className="rounded-lg border border-[#F7F9FC] transition hover:border-[#E4E7EC]">
                <button onClick={() => setExpanded(isOpen ? null : r.tenantId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <div className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#101828]">{r.tenantName}</p>
                    <p className="text-[10px] text-[#667085]">{r.plan}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: color }}>
                      {r.riskLevel}
                    </span>
                    <p className="mt-0.5 text-[10px] text-[#667085]">Score: {r.overallScore}</p>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-[#F7F9FC] px-4 py-3">
                    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {r.factors.map((f, i) => (
                        <div key={i} className="rounded-lg bg-[#F7F9FC] p-2">
                          <p className="text-[10px] font-semibold uppercase text-[#667085]">{f.category}</p>
                          <p className="text-xs font-bold text-[#101828]">{f.label}</p>
                          <p className="text-[10px] text-[#98A2B3]">{f.detail}</p>
                        </div>
                      ))}
                      {r.factors.length === 0 && (
                        <div className="col-span-full rounded-lg bg-[#F7F9FC] p-2 text-center">
                          <p className="text-[10px] text-[#667085]">Tidak ada faktor risiko</p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg bg-[#0D6EFD]/5 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-[#0D6EFD]">Rekomendasi</p>
                      <p className="text-xs text-[#101828]">{r.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
