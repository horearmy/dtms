'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceDot,
} from 'recharts';
import { AlertTriangle, RefreshCw, Activity, Filter } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';

type Anomaly = {
  id: string; metric: string; dimension: string; expectedValue: number; actualValue: number;
  deviation: number; severity: string; description: string; detectedAt: string; period: string;
};
type AnomalyData = {
  anomalies: Anomaly[];
  summary: { total: number; critical: number; high: number; medium: number; low: number;
    byMetric: Record<string, number>;
  };
  monthlyData: { month: string; shipments: number; failed: number; exceptions: number; revenue: number; integrationErrors: number }[];
};

const SEV_COLORS: Record<string, string> = { CRITICAL: '#F5222D', HIGH: '#FF8A00', MEDIUM: '#0D6EFD', LOW: '#16B364' };

export default function AnomalyDetectionPage() {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [metricFilter, setMetricFilter] = useState('all');
  const [chartMetric, setChartMetric] = useState('shipments');

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/platform/reports/anomalies', { signal });
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

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat anomaly detection...</p>
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

  const filtered = data.anomalies.filter((a) => metricFilter === 'all' || a.metric.toLowerCase().includes(metricFilter));

  // Build chart data with anomaly markers
  const anomalyPeriods = new Set(filtered.map((a) => a.period));
  const chartData = data.monthlyData.map((d) => ({
    ...d,
    anomaly: anomalyPeriods.has(d.month) ? d[chartMetric as keyof typeof d] as number : null,
  }));

  const metricKeyMap: Record<string, string> = {
    shipments: 'Shipment Volume', failed: 'Failed Deliveries',
    exceptions: 'Exceptions', revenue: 'Revenue', integrationErrors: 'Integration Errors',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101828]">Anomaly Detection</h1>
          <p className="text-xs text-[#667085]">Deteksi pola tidak wajar menggunakan Z-score statistical analysis</p>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]"
          disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Total Anomalies" value={data.summary.total} icon={<Activity size={18} />} color="#FF8A00" />
        <KPICard label="Critical" value={data.summary.critical} icon={<AlertTriangle size={18} />} color="#F5222D" />
        <KPICard label="High" value={data.summary.high} icon={<AlertTriangle size={18} />} color="#FF8A00" />
        <KPICard label="Medium" value={data.summary.medium} icon={<AlertTriangle size={18} />} color="#0D6EFD" />
        <KPICard label="Low" value={data.summary.low} icon={<AlertTriangle size={18} />} color="#16B364" />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#101828]">Anomaly Trend</h3>
          <select value={chartMetric} onChange={(e) => setChartMetric(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] px-2 py-1 text-[11px] text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
            <option value="shipments">Shipments</option>
            <option value="failed">Failed</option>
            <option value="exceptions">Exceptions</option>
            <option value="revenue">Revenue</option>
            <option value="integrationErrors">Integration Errors</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F7F9FC" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#667085' }} />
            <YAxis tick={{ fontSize: 10, fill: '#667085' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey={chartMetric} stroke="#0D6EFD" strokeWidth={2} dot={false} name={metricKeyMap[chartMetric] || chartMetric} />
            <Line type="monotone" dataKey="anomaly" stroke="#F5222D" strokeWidth={0} dot={{ r: 6, fill: '#F5222D', stroke: '#fff', strokeWidth: 2 }} name="Anomaly" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Anomaly List */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={14} className="text-[#667085]" />
          <select value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] px-2 py-1 text-[11px] text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
            <option value="all">Semua Metric</option>
            <option value="shipment">Shipment Volume</option>
            <option value="failed">Failed Deliveries</option>
            <option value="exception">Exceptions</option>
            <option value="revenue">Revenue</option>
            <option value="integration">Integration Errors</option>
          </select>
          <span className="text-[10px] text-[#98A2B3]">{filtered.length} anomalies</span>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada anomali terdeteksi</p>
          )}
          {filtered.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-[#F7F9FC] p-3 hover:border-[#E4E7EC]">
              <div className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: SEV_COLORS[a.severity] }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded px-1.5 py-px text-[9px] font-bold uppercase text-white" style={{ backgroundColor: SEV_COLORS[a.severity] }}>
                    {a.severity}
                  </span>
                  <span className="text-[10px] text-[#667085]">{a.metric} &middot; {a.period}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#101828]">{a.description}</p>
                <div className="mt-1 flex gap-4 text-[10px] text-[#667085]">
                  <span>Expected: <strong>{a.expectedValue.toLocaleString('id-ID')}</strong></span>
                  <span>Actual: <strong className={a.deviation > 0 ? 'text-[#F5222D]' : 'text-[#0D6EFD]'}>{a.actualValue.toLocaleString('id-ID')}</strong></span>
                  <span>Deviation: <strong>{a.deviation > 0 ? '+' : ''}{a.deviation}%</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
