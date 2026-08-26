'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import { TrendingUp, RefreshCw, BarChart3 } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';

type ForecastData = {
  historical: {
    shipments: { month: string; delivered: number; total: number; failed: number }[];
    revenue: { month: string; billed: number; collected: number }[];
  };
  forecast: {
    shipments: { month: string; predicted: number; lower: number; upper: number }[];
    revenue: { month: string; predictedBilled: number; predictedCollected: number }[];
  };
  metrics: {
    shipmentR2: number; revenueR2: number; forecastGrowthPct: number;
    currentMonthly: number; forecastMonthly: number;
  };
};

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [forecastMonths, setForecastMonths] = useState(6);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/platform/reports/forecast?months=${forecastMonths}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message || 'Gagal memuat data');
    }
  }, [forecastMonths]);

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
          <p className="text-sm text-[#667085]">Memuat forecast...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <BarChart3 size={32} className="mx-auto mb-3 text-[#F5222D]" />
          <p className="text-sm font-semibold text-[#F5222D]">{error}</p>
          <button onClick={handleRefresh} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Merge historical + forecast for chart
  const shipChartData = [
    ...data.historical.shipments.map((s) => ({ month: s.month, delivered: s.delivered, predicted: null as number | null, lower: null as number | null, upper: null as number | null })),
    ...data.forecast.shipments.map((s) => ({ month: s.month, delivered: null as number | null, predicted: s.predicted, lower: s.lower, upper: s.upper })),
  ];

  const revChartData = [
    ...data.historical.revenue.map((r) => ({ month: r.month, billed: r.billed / 1_000_000, collected: r.collected / 1_000_000, predictedBilled: null as number | null, predictedCollected: null as number | null })),
    ...data.forecast.revenue.map((r) => ({ month: r.month, billed: null as number | null, collected: null as number | null, predictedBilled: r.predictedBilled / 1_000_000, predictedCollected: r.predictedCollected / 1_000_000 })),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#101828]">Forecast</h1>
          <p className="text-xs text-[#667085]">Proyeksi shipment volume dan revenue berdasarkan tren historical</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={forecastMonths} onChange={(e) => setForecastMonths(parseInt(e.target.value))}
            className="rounded-lg border border-[#E4E7EC] px-2 py-1.5 text-[11px] text-[#101828] focus:border-[#0D6EFD] focus:outline-none">
            <option value={3}>3 bulan</option>
            <option value={6}>6 bulan</option>
            <option value={12}>12 bulan</option>
          </select>
          <button onClick={handleRefresh}
            className="flex items-center gap-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#667085] hover:bg-[#F7F9FC]"
            disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Current Monthly" value={data.metrics.currentMonthly.toLocaleString('id-ID')} icon={<BarChart3 size={18} />} color="#0D6EFD" subtitle="Shipment/bulan" />
        <KPICard label="Forecast Monthly" value={data.metrics.forecastMonthly.toLocaleString('id-ID')} icon={<TrendingUp size={18} />} color="#16B364" subtitle={`Next month`} changePct={data.metrics.forecastGrowthPct} />
        <KPICard label="Shipment R²" value={`${(data.metrics.shipmentR2 * 100).toFixed(0)}%`} icon={<TrendingUp size={18} />} color="#7C3AED" subtitle="Model accuracy" />
        <KPICard label="Revenue R²" value={`${(data.metrics.revenueR2 * 100).toFixed(0)}%`} icon={<TrendingUp size={18} />} color="#FF8A00" subtitle="Model accuracy" />
      </div>

      {/* Shipment Forecast Chart */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-[#101828]">Shipment Volume Forecast</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={shipChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F7F9FC" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#667085' }} />
            <YAxis tick={{ fontSize: 10, fill: '#667085' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend />
            <Area type="monotone" dataKey="delivered" stroke="#0D6EFD" fill="#0D6EFD20" name="Delivered (Actual)" strokeWidth={2} />
            <Area type="monotone" dataKey="predicted" stroke="#16B364" fill="#16B36420" name="Predicted" strokeWidth={2} strokeDasharray="5 5" />
            <Area type="monotone" dataKey="upper" stroke="transparent" fill="#16B36410" name="Upper Bound" />
            <Area type="monotone" dataKey="lower" stroke="transparent" fill="#16B36410" name="Lower Bound" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Forecast Chart */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-[#101828]">Revenue Forecast (Rp Juta)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={revChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F7F9FC" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#667085' }} />
            <YAxis tick={{ fontSize: 10, fill: '#667085' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => `Rp ${(v).toFixed(1)}M`} />
            <Legend />
            <Line type="monotone" dataKey="billed" stroke="#7C3AED" name="Billed (Actual)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="collected" stroke="#16B364" name="Collected (Actual)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="predictedBilled" stroke="#7C3AED" name="Billed (Forecast)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="predictedCollected" stroke="#16B364" name="Collected (Forecast)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
