'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from '@/components/recharts-lazy';
import { FileText, Download, RefreshCw, BarChart3, PieChart as PieChartIcon } from 'lucide-react';

type DatasetOption = { value: string; label: string; dimensions: { value: string; label: string }[] };

const DATASETS: DatasetOption[] = [
  { value: 'shipments', label: 'Shipments', dimensions: [
    { value: 'status', label: 'Status' }, { value: 'serviceType', label: 'Service Type' },
    { value: 'origin', label: 'Origin' }, { value: 'destination', label: 'Destination' },
  ]},
  { value: 'tenants', label: 'Tenants', dimensions: [
    { value: 'status', label: 'Status' }, { value: 'plan', label: 'Plan' },
  ]},
  { value: 'customers', label: 'Customers', dimensions: [
    { value: 'city', label: 'City' }, { value: 'province', label: 'Province' },
  ]},
  { value: 'drivers', label: 'Drivers', dimensions: [
    { value: 'status', label: 'Status' },
  ]},
  { value: 'vehicles', label: 'Vehicles', dimensions: [
    { value: 'vehicleType', label: 'Vehicle Type' }, { value: 'status', label: 'Status' },
  ]},
  { value: 'exceptions', label: 'Exceptions', dimensions: [
    { value: 'type', label: 'Type' }, { value: 'severity', label: 'Severity' },
    { value: 'status', label: 'Status' },
  ]},
  { value: 'invoices', label: 'Invoices', dimensions: [
    { value: 'status', label: 'Status' },
  ]},
  { value: 'integration_logs', label: 'Integration Logs', dimensions: [
    { value: 'direction', label: 'Direction' }, { value: 'statusGroup', label: 'Status Group' },
    { value: 'integrationType', label: 'Integration Type' },
  ]},
];

const METRICS = [
  { value: 'count', label: 'Count' },
  { value: 'total_billed', label: 'Total Billed' },
  { value: 'total_paid', label: 'Total Paid' },
];

const PRESETS = [
  { value: 'this_month', label: 'Bulan Ini' }, { value: 'last_30_days', label: '30 Hari' },
  { value: 'last_7_days', label: '7 Hari' }, { value: 'today', label: 'Hari Ini' },
  { value: 'last_month', label: 'Bulan Lalu' }, { value: 'this_quarter', label: 'Kuartal Ini' },
];

const CHART_COLORS = ['#0D6EFD', '#16B364', '#F5222D', '#FF8A00', '#7C3AED', '#667085', '#0EA5E9', '#D946EF', '#14B8A6', '#F97316'];

type ReportResult = {
  dataset: string; dimension: string; metric: string; preset: string;
  data: { label: string; value: number }[];
};

export default function ReportBuilderPage() {
  const [dataset, setDataset] = useState('shipments');
  const [dimension, setDimension] = useState('status');
  const [metric, setMetric] = useState('count');
  const [preset, setPreset] = useState('this_month');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dsOption = DATASETS.find((d) => d.value === dataset)!;

  useEffect(() => {
    const dims = dsOption.dimensions;
    if (!dims.find((d) => d.value === dimension)) setDimension(dims[0].value);
  }, [dataset, dimension, dsOption.dimensions]);

  const fetchReport = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/platform/reports/custom?dataset=${dataset}&dimension=${dimension}&metric=${metric}&preset=${preset}&limit=20`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Gagal memuat laporan');
    }
    finally { setLoading(false); }
  }, [dataset, dimension, metric, preset]);

  useEffect(() => {
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (!result) return;
    const csv = ['Label,Value', ...result.data.map((d) => `${d.label},${d.value}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `report_${result.dataset}_${result.dimension}_${result.metric}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const total = result?.data.reduce((s, d) => s + d.value, 0) || 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101828]">Report Builder</h1>
          <p className="text-xs text-[#667085]">Buat laporan custom dari dataset platform</p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button onClick={handleExportCSV}
              className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={() => fetchReport()}
            className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]"
            disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Dataset</label>
            <select value={dataset} onChange={(e) => setDataset(e.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
              {DATASETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Dimension</label>
            <select value={dimension} onChange={(e) => setDimension(e.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
              {dsOption.dimensions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-[#667085]">Periode</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#F5222D]/20 bg-[#F5222D]/5 px-4 py-3 text-xs text-[#F5222D]">{error}</div>
      )}

      {/* Result */}
      {result && result.data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Chart */}
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#101828]">
                  {DATASETS.find((d) => d.value === result.dataset)?.label} by{' '}
                  {dsOption.dimensions.find((d) => d.value === result.dimension)?.label}
                </h3>
                <p className="text-[10px] text-[#667085]">{METRICS.find((m) => m.value === result.metric)?.label} &middot; {PRESETS.find((p) => p.value === result.preset)?.label}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setChartType('bar')}
                  className={`rounded-lg p-1.5 ${chartType === 'bar' ? 'bg-[#0D6EFD] text-white' : 'text-[#667085] hover:bg-[#F7F9FC]'}`}>
                  <BarChart3 size={14} />
                </button>
                <button onClick={() => setChartType('pie')}
                  className={`rounded-lg p-1.5 ${chartType === 'pie' ? 'bg-[#0D6EFD] text-white' : 'text-[#667085] hover:bg-[#F7F9FC]'}`}>
                  <PieChartIcon size={14} />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              {chartType === 'bar' ? (
                <BarChart data={result.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F7F9FC" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#667085' }} angle={-35} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10, fill: '#667085' }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {result.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie data={result.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={120} label={({ label, percent }: any) => `${label} (${(percent * 100).toFixed(0)}%)`} labelLine>
                    {result.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-[#101828]">Summary</h3>
            <div className="mb-4 text-center">
              <p className="text-2xl font-bold text-[#101828]">{total.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-[#667085]">Total {METRICS.find((m) => m.value === result.metric)?.label}</p>
            </div>
            <div className="space-y-2">
              {result.data.slice(0, 10).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-[#667085]">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {d.label}
                  </span>
                  <span className="font-semibold text-[#101828]">{d.value.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {result && result.data.length === 0 && !loading && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-12 text-center">
          <FileText size={32} className="mx-auto mb-2 text-[#D0D5DD]" />
          <p className="text-sm font-semibold text-[#667085]">Tidak ada data</p>
          <p className="text-xs text-[#98A2B3]">Coba ubah dataset, dimension, atau periode</p>
        </div>
      )}
    </div>
  );
}
