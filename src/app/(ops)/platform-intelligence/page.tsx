'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Building2, Package, CreditCard, Activity, Users, Truck, Car, AlertTriangle, Clock, RefreshCw, Download } from 'lucide-react';
import Link from 'next/link';
import KPICard from '@/components/platform/KPICard';
import AlertCenter from '@/components/platform/AlertCenter';
import ExecutiveInsights from '@/components/platform/ExecutiveInsights';
import DrillDownModal, { DrillDownData } from '@/components/platform/DrillDownModal';
import { useNotification } from '@/components/ui/NotificationContext';

type ExecutiveData = {
  period: { from: string; to: string };
  tenant: { total: number; active: number; newThisPeriod: number; byStatus: { status: string; count: number }[]; growth: { current: number; previous: number; changePct: number } };
  delivery: { total: number; delivered: number; failed: number; inTransit: number; active: number; successRate: number; failureRate: number; byStatus: { status: string; count: number }[]; byServiceType: { serviceType: string; count: number }[]; growth: { current: number; previous: number; changePct: number } };
  sla: { onTimeRate: number; onTime: number; atRisk: number; breached: number; totalEvaluated: number };
  revenue: { mrr: number; arr: number; totalBilled: number; totalCollected: number; outstanding: number; overdueAmount: number; overdueCount: number; collectionRate: number; growth: { current: number; previous: number; changePct: number }; fmtMrr: string; fmtArr: string };
  usage: { activeUsers: number; activeDrivers: number; activeVehicles: number; totalShipments: number; openExceptions: number };
  health: { apiSuccessRate: number; avgLatencyMs: number; integrationLogs: number };
  alerts: { severity: string; title: string; description: string; count: number }[];
  insights: { type: string; text: string }[];
};

const STATUS_COLORS: Record<string, string> = {
  ORDER_CREATED: '#667085',
  WAREHOUSE_RECEIVED: '#FF8A00',
  DISPATCHED: '#0D6EFD',
  IN_TRANSIT: '#7C3AED',
  ARRIVED_AT_HUB: '#0D6EFD',
  OUT_FOR_DELIVERY: '#16B364',
  RESCHEDULED: '#FF8A00',
  DELIVERED: '#16B364',
  DELIVERY_FAILED: '#F5222D',
  RETURNED: '#F5222D',
  CANCELLED: '#667085',
};

const STATUS_LABELS: Record<string, string> = {
  ORDER_CREATED: 'Order Dibuat',
  WAREHOUSE_RECEIVED: 'Diterima Gudang',
  DISPATCHED: 'Dispatched',
  IN_TRANSIT: 'In Transit',
  ARRIVED_AT_HUB: 'Di Hub',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  RESCHEDULED: 'Rescheduled',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Gagal',
  RETURNED: 'Returned',
  CANCELLED: 'Cancelled',
};

const PRESETS = [
  { value: 'this_month', label: 'Bulan Ini' },
  { value: 'last_30_days', label: '30 Hari' },
  { value: 'last_7_days', label: '7 Hari' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'this_quarter', label: 'Kuartal Ini' },
  { value: 'this_year', label: 'Tahun Ini' },
];

export default function PlatformIntelligencePage() {
  const { success, error: notifyError } = useNotification();
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [refreshing, setRefreshing] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const openDrillDown = async (type: string, params?: Record<string, string>) => {
    setDrillLoading(true);
    try {
      const qs = new URLSearchParams({ type, ...params }).toString();
      const res = await fetch(`/api/platform/reports/drilldown?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDrillDown(await res.json());
    } catch {
      setDrillDown(null);
    } finally {
      setDrillLoading(false);
    }
  };

  const fetchData = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/platform/reports/executive?preset=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(preset).finally(() => setLoading(false));
  }, [preset, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(preset);
    setRefreshing(false);
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/platform/reports/pdf?preset=${preset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DTMS_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('PDF Report berhasil diunduh');
    } catch {
      notifyError('Gagal generate PDF', 'Silakan coba lagi.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat data executive...</p>
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
          <button onClick={() => fetchData(preset)} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const deliveryByStatusData = data.delivery.byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ name: STATUS_LABELS[s.status] || s.status, value: s.count, fill: STATUS_COLORS[s.status] || '#667085' }));

  const slaData = [
    { name: 'On Track', value: data.sla.onTime, fill: '#16B364' },
    { name: 'At Risk', value: data.sla.atRisk, fill: '#FF8A00' },
    { name: 'Breached', value: data.sla.breached, fill: '#F5222D' },
  ].filter((d) => d.value > 0);

  const tenantByStatusData = data.tenant.byStatus.map((s) => ({ name: s.status, count: s.count }));

  const RADIAN = Math.PI / 180;
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Platform Intelligence</h1>
          <p className="text-xs text-[#667085]">Executive overview seluruh aktivitas platform</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:border-[#0D6EFD] focus:outline-none"
          >
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC] disabled:opacity-50"
            title="Export PDF Report"
          >
            <Download size={14} className={generatingPdf ? 'animate-bounce' : ''} />
            <span className="hidden sm:inline">{generatingPdf ? 'Generating...' : 'PDF'}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC] disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Row 1: Tenant + Delivery + Revenue + SLA + Health */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button onClick={() => openDrillDown('tenants')} className="text-left">
          <KPICard label="Total Tenant" value={data.tenant.total} changePct={data.tenant.growth.changePct} icon={<Building2 size={18} />} color="#0D6EFD" subtitle={`${data.tenant.active} aktif`} />
        </button>
        <button onClick={() => openDrillDown('shipments_active')} className="text-left">
          <KPICard label="Total Pengiriman" value={data.delivery.total.toLocaleString('id-ID')} changePct={data.delivery.growth.changePct} icon={<Package size={18} />} color="#16B364" subtitle={`${data.delivery.delivered} delivered`} />
        </button>
        <button onClick={() => openDrillDown('revenue_by_tenant')} className="text-left">
          <KPICard label="MRR" value={data.revenue.fmtMrr} changePct={data.revenue.growth.changePct} icon={<CreditCard size={18} />} color="#7C3AED" subtitle={`ARR ${data.revenue.fmtArr}`} />
        </button>
        <button onClick={() => openDrillDown('sla_breached')} className="text-left">
          <KPICard label="SLA On-Time" value={`${data.sla.onTimeRate}%`} icon={<Clock size={18} />} color="#16B364" subtitle={`${data.sla.totalEvaluated} dievaluasi`} />
        </button>
        <KPICard label="API Health" value={`${data.health.apiSuccessRate}%`} icon={<Activity size={18} />} color="#0D6EFD" subtitle={`${data.health.avgLatencyMs}ms avg`} />
      </div>

      {/* KPI Row 2: Usage */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Active Users" value={data.usage.activeUsers} icon={<Users size={18} />} color="#0D6EFD" />
        <KPICard label="Active Drivers" value={data.usage.activeDrivers.toLocaleString('id-ID')} icon={<Truck size={18} />} color="#16B364" />
        <KPICard label="Active Vehicles" value={data.usage.activeVehicles} icon={<Car size={18} />} color="#FF8A00" />
        <Link href="/platform-intelligence/exceptions" className="block hover:ring-2 hover:ring-[#F5222D]/20 rounded-xl transition">
          <KPICard label="Open Exceptions" value={data.usage.openExceptions} icon={<AlertTriangle size={18} />} color="#F5222D" />
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Delivery by Status */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Pengiriman per Status</h3>
          {deliveryByStatusData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deliveryByStatusData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }}
                  formatter={(value: any) => [Number(value).toLocaleString('id-ID'), 'Shipment']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {deliveryByStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* SLA Pie */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">SLA Performance</h3>
          {slaData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data SLA</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={slaData} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false} label={renderPieLabel}>
                  {slaData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }}
                  formatter={(value: any) => [Number(value).toLocaleString('id-ID'), 'Shipment']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tenant by Status */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Tenant per Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tenantByStatusData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} />
              <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }}
                  formatter={(value: any) => [Number(value), 'Tenant']}
                />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#0D6EFD" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Delivery by Service Type */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Pengiriman per Tipe Layanan</h3>
          {data.delivery.byServiceType.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={data.delivery.byServiceType.map((s) => ({ name: s.serviceType || 'N/A', count: s.count }))}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} width={90} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }}
                  formatter={(value: any) => [Number(value).toLocaleString('id-ID'), 'Shipment']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#7C3AED" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue Summary Mini-Table */}
      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h3 className="mb-4 text-sm font-bold text-[#101828]">Revenue Summary</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#667085]">Total Billed</p>
            <p className="mt-1 text-lg font-bold text-[#101828]">Rp {(data.revenue.totalBilled / 1_000_000).toFixed(1)}M</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#667085]">Collected</p>
            <p className="mt-1 text-lg font-bold text-[#16B364]">Rp {(data.revenue.totalCollected / 1_000_000).toFixed(1)}M</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#667085]">Outstanding</p>
            <p className="mt-1 text-lg font-bold text-[#FF8A00]">Rp {(data.revenue.outstanding / 1_000_000).toFixed(1)}M</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#667085]">Overdue</p>
            <p className="mt-1 text-lg font-bold text-[#F5222D]">Rp {(data.revenue.overdueAmount / 1_000_000).toFixed(1)}M</p>
            <p className="text-[10px] text-[#667085]">{data.revenue.overdueCount} invoice</p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
          <div className="h-full rounded-full bg-[#16B364]" style={{ width: `${Math.min(data.revenue.collectionRate, 100)}%` }} />
        </div>
        <p className="mt-1 text-right text-[10px] text-[#667085]">Collection Rate: {data.revenue.collectionRate}%</p>
      </div>

      {/* Alerts + Insights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlertCenter alerts={data.alerts} />
        <ExecutiveInsights insights={data.insights} />
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
