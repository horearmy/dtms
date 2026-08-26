'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Activity, AlertTriangle, RefreshCw, Database, Plug, Webhook, Key, XCircle, Server } from 'lucide-react';
import KPICard from '@/components/platform/KPICard';
import ExecutiveInsights from '@/components/platform/ExecutiveInsights';

type SystemHealthData = {
  api: { successRate: number; prevSuccessRate: number; successTrend: number; requestsLastHour: number; errorsLastHour: number; errorRate: number };
  webhook: { successRate: number; delivered24h: number; failed24h: number; total24h: number };
  infrastructure: { activeIntegrations: number; activeWebhooks: number; activeApiKeys: number };
  database: { name: string; count: number }[];
  recentErrors: { id: string; direction: string; method: string | null; path: string | null; statusCode: number | null; error: string | null; durationMs: number | null; createdAt: string }[];
  hourlyTrend: { hour: string; count: number }[];
  insights: { type: string; text: string }[];
};

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/platform/reports/system-health', { signal });
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

  useEffect(() => {
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  if (loading && !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#0D6EFD] border-t-transparent" />
          <p className="text-sm text-[#667085]">Memuat system health...</p>
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
          <button onClick={() => fetchData()} className="mt-3 rounded-lg bg-[#0D6EFD] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B5ED7]">Coba Lagi</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const dbTotal = data.database.reduce((s, d) => s + d.count, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">System Health</h1>
          <p className="text-xs text-[#667085]">Real-time monitoring API, webhook, database, dan infrastructure</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#16B364]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#16B364]" /> Auto-refresh 30s
          </span>
          <button onClick={handleRefresh} disabled={refreshing}
            className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-semibold text-[#101828] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC] disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard label="API Success Rate" value={`${data.api.successRate}%`} changePct={data.api.successTrend} icon={<Activity size={18} />} color={data.api.successRate >= 95 ? '#16B364' : '#F5222D'} subtitle={`${data.api.requestsLastHour} req/hr`} />
        <KPICard label="Error Rate" value={`${data.api.errorRate}%`} icon={<XCircle size={18} />} color={data.api.errorRate <= 5 ? '#16B364' : '#F5222D'} subtitle={`${data.api.errorsLastHour} errors/hr`} />
        <KPICard label="Webhook Success" value={`${data.webhook.successRate}%`} icon={<Webhook size={18} />} color="#7C3AED" subtitle={`${data.webhook.delivered24h}/${data.webhook.total24h} (24h)`} />
        <KPICard label="Active Integrations" value={data.infrastructure.activeIntegrations} icon={<Plug size={18} />} color="#0D6EFD" />
        <KPICard label="Active Webhooks" value={data.infrastructure.activeWebhooks} icon={<Webhook size={18} />} color="#16B364" />
        <KPICard label="Active API Keys" value={data.infrastructure.activeApiKeys} icon={<Key size={18} />} color="#FF8A00" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hourly Request Trend */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-sm font-bold text-[#101828]">API Request Trend (24 Jam)</h3>
          {data.hourlyTrend.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#667085]">Tidak ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.hourlyTrend.map((h) => ({ hour: new Date(h.hour).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), count: h.count }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#667085' }} />
                <YAxis tick={{ fontSize: 10, fill: '#667085' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E7EC' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#0D6EFD" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Database Stats */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <Database size={16} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-[#101828]">Database Overview</h3>
            <span className="ml-auto text-[10px] font-semibold text-[#667085]">{dbTotal.toLocaleString('id-ID')} total rows</span>
          </div>
          <div className="space-y-2">
            {data.database.map((d) => {
              const pct = dbTotal > 0 ? (d.count / dbTotal) * 100 : 0;
              return (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-[110px] shrink-0 text-[11px] font-semibold text-[#667085]">{d.name}</span>
                  <div className="min-w-0 flex-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                      <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <span className="w-[70px] shrink-0 text-right text-[11px] font-bold text-[#101828]">{d.count.toLocaleString('id-ID')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {data.recentErrors.length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <XCircle size={16} className="text-[#F5222D]" />
            <h3 className="text-sm font-bold text-[#101828]">Recent Errors (24 Jam)</h3>
            <span className="rounded-full bg-[#F5222D] px-2 py-0.5 text-[10px] font-bold text-white">{data.recentErrors.length}</span>
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
                {data.recentErrors.map((e) => (
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
