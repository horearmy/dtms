'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { Plug, AlertTriangle, RefreshCw, Clock, Key, Webhook, CheckCircle2, XCircle } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import ExecutiveInsights from '@/components/platform/ExecutiveInsights';

type IntegrationData = {
  period: { from: string; to: string };
  summary: { totalLogs: number; successRate: number; errorRate: number; avgLatencyMs: number; maxLatencyMs: number; minLatencyMs: number };
  byDirection: { direction: string; count: number }[];
  byStatusGroup: { group: string; count: number }[];
  byIntegration: { integrationId: string; name: string; count: number; errors: number; avgDurationMs: number }[];
  errors: { id: string; direction: string; method: string | null; path: string | null; statusCode: number | null; error: string | null; durationMs: number | null; createdAt: string }[];
  webhook: { total: number; success: number; failed: number; successRate: number; byStatus: { status: string; count: number }[] };
  apiKeys: { total: number; active: number; expired: number };
  trend: { date: string; count: number }[];
  insights: { type: string; text: string }[];
};

const STATUS_GROUP_COLORS: Record<string, string> = { '2xx': '#16B364', '3xx': '#0D6EFD', '4xx': '#FF8A00', '5xx': '#F5222D', 'No Status': '#667085' };
const DIRECTION_COLORS: Record<string, string> = { INBOUND: '#0D6EFD', OUTBOUND: '#7C3AED', WEBHOOK: '#16B364' };
const PRESETS = [
  { value: 'this_month', label: 'Bulan Ini' }, { value: 'last_30_days', label: '30 Hari' },
  { value: 'last_7_days', label: '7 Hari' }, { value: 'today', label: 'Hari Ini' },
  { value: 'this_quarter', label: 'Kuartal Ini' }, { value: 'this_year', label: 'Tahun Ini' },
];

export default function IntegrationAnalyticsPage() {
  const [data, setData] = useState<IntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/platform/reports/integrations?preset=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError('');
    } catch (e: any) { setError(e.message || 'Gagal memuat data'); }
  }, []);

  useEffect(() => { setLoading(true); fetchData(preset).finally(() => setLoading(false)); }, [preset, fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(preset); setRefreshing(false); };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat integration analytics...</p>
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

  const statusData = data.byStatusGroup.filter((s) => s.count > 0).map((s) => ({ name: s.group, value: s.count, fill: STATUS_GROUP_COLORS[s.group] || '#667085' }));
  const directionData = data.byDirection.map((d) => ({ name: d.direction, value: d.count, fill: DIRECTION_COLORS[d.direction] || '#667085' }));

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Integration Analytics</h1>
          <p className="text-xs text-[#667085]">API health, error rate, latency, webhook delivery, dan API keys</p>
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

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="Total API Calls" value={data.summary.totalLogs.toLocaleString('id-ID')} icon={<Plug size={18} />} color="#0D6EFD" />
        <KPICard label="Success Rate" value={`${data.summary.successRate}%`} icon={<CheckCircle2 size={18} />} color={data.summary.successRate >= 95 ? '#16B364' : '#F5222D'} />
        <KPICard label="Error Rate" value={`${data.summary.errorRate}%`} icon={<XCircle size={18} />} color={data.summary.errorRate <= 5 ? '#16B364' : '#F5222D'} />
        <KPICard label="Avg Latency" value={`${data.summary.avgLatencyMs}ms`} icon={<Clock size={18} />} color={data.summary.avgLatencyMs <= 3000 ? '#16B364' : '#FF8A00'} subtitle={`Max: ${data.summary.maxLatencyMs}ms`} />
        <KPICard label="Webhook Success" value={`${data.webhook.successRate}%`} icon={<Webhook size={18} />} color="#7C3AED" subtitle={`${data.webhook.success}/${data.webhook.total}`} />
        <KPICard label="API Keys" value={data.apiKeys.total} icon={<Key size={18} />} color="#FF8A00" subtitle={`${data.apiKeys.active} active, ${data.apiKeys.expired} expired`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Request Trend */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">API Request Trend</h3>
          {data.trend.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Line type="monotone" dataKey="count" stroke="#0D6EFD" strokeWidth={2} dot={{ r: 3, fill: '#0D6EFD' }} name="Requests" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Group Pie */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Response Status Distribution</h3>
          {statusData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false} label={renderPieLabel}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By Direction Pie */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Request by Direction</h3>
          {directionData.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={directionData} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false} label={renderPieLabel}>
                  {directionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Integrations Bar */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Top Integrations by Usage</h3>
          {data.byIntegration.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byIntegration.map((i) => ({ name: i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name, calls: i.count, errors: i.errors }))} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#667085' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#667085' }} width={110} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Bar dataKey="calls" stackId="a" radius={[0, 0, 0, 0]} fill="#0D6EFD" name="Calls" />
                <Bar dataKey="errors" stackId="a" radius={[0, 4, 4, 0]} fill="#F5222D" name="Errors" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Integration Performance Table */}
      {data.byIntegration.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">Integration Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Integration</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Calls</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Errors</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Error Rate</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.byIntegration.map((i) => {
                  const errRate = i.count > 0 ? (i.errors / i.count) * 100 : 0;
                  return (
                    <tr key={i.integrationId} className="border-b border-[#F7F9FC]">
                      <td className="py-2 font-semibold text-[#101828]">{i.name}</td>
                      <td className="py-2 text-right font-semibold text-[#101828]">{i.count.toLocaleString('id-ID')}</td>
                      <td className="py-2 text-right font-semibold text-[#101828]">{i.errors}</td>
                      <td className="py-2 text-right">
                        <span className={errRate > 5 ? 'font-bold text-[#F5222D]' : 'text-[#667085]'}>{errRate.toFixed(1)}%</span>
                      </td>
                      <td className="py-2 text-right text-[#667085]">{i.avgDurationMs}ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {data.errors.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <XCircle size={16} className="text-[#F5222D]" />
            <h3 className="text-sm font-bold text-[#101828]">Recent Errors</h3>
            <span className="rounded-full bg-[#F5222D] px-2 py-0.5 text-[10px] font-bold text-white">{data.errors.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="pb-2 font-semibold text-[#667085]">Time</th>
                  <th className="pb-2 font-semibold text-[#667085]">Method</th>
                  <th className="pb-2 font-semibold text-[#667085]">Path</th>
                  <th className="pb-2 text-right font-semibold text-[#667085]">Status</th>
                  <th className="pb-2 font-semibold text-[#667085]">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((e) => (
                  <tr key={e.id} className="border-b border-[#F7F9FC]">
                    <td className="py-2 text-[#667085]">{new Date(e.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2 font-semibold text-[#101828]">{e.method || '-'}</td>
                    <td className="py-2 max-w-[200px] truncate text-[#667085]">{e.path || '-'}</td>
                    <td className="py-2 text-right">
                      <span className={`inline-block rounded px-1.5 py-px text-[9px] font-bold text-white ${e.statusCode && e.statusCode >= 500 ? 'bg-[#F5222D]' : 'bg-[#FF8A00]'}`}>
                        {e.statusCode || 'ERR'}
                      </span>
                    </td>
                    <td className="py-2 max-w-[250px] truncate text-[#667085]">{e.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      <ExecutiveInsights insights={data.insights} />
    </div>
  );
}
