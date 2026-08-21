'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { formatDateTime } from '@/lib/constants';
import { Modal, inputCls, btnPrimary, btnGhost } from '@/components/ui';
import { Activity, Shield, Zap, AlertTriangle, CheckCircle, XCircle, Users, Truck } from 'lucide-react';

const GlobalMap = dynamic(() => import('./GlobalMap'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-[#667085]">Memuat peta...</div> });

type TenantThrottle = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  rateLimit: {
    apiMaxRequests: number;
    apiWindowMs: number;
    gpsMaxRequests: number;
    gpsWindowMs: number;
    active: boolean;
    blocked: boolean;
  } | null;
};

type HeatPoint = {
  lat: number;
  lng: number;
  intensity: number;
  tenantId: string;
  tenantName: string;
  driverName: string;
};

type TenantStat = {
  name: string;
  driverCount: number;
  pointCount: number;
};

export default function GlobalControlTowerPage() {
  const [tenants, setTenants] = useState<TenantThrottle[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [tenantStats, setTenantStats] = useState<Record<string, TenantStat>>({});
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editTenant, setEditTenant] = useState<TenantThrottle | null>(null);
  const [throttleForm, setThrottleForm] = useState({ apiMaxRequests: 300, gpsMaxRequests: 60, active: true, blocked: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [mapCenter] = useState<[number, number]>([-6.2088, 106.8456]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [trends, setTrends] = useState({ driverTrend: 0, blockedTrend: 0, tenantTrend: 0 });
  const [health, setHealth] = useState<{
    apiSuccessRate: number;
    apiSuccessTrend: number;
    webhookSuccessRate: number;
    errorRate: number;
    errorTrend: number;
    currentRequests: number;
    currentErrors: number;
    activeIntegrations: number;
  } | null>(null);

  const loadTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/throttle');
      if (res.ok) setTenants(await res.json());
    } catch {}
  }, []);

  const loadHeatmap = useCallback(async () => {
    try {
      const res = await fetch('/api/gps/global?minutes=60');
      if (res.ok) {
        const data = await res.json();
        setHeatPoints(data.points);
        setTenantStats(data.tenantStats);
        setTotalPoints(data.total);
        if (data.trends) setTrends(data.trends);
      }
    } catch {}
    setLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-health');
      if (res.ok) setHealth(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadTenants();
    loadHeatmap();
    loadHealth();
  }, [loadTenants, loadHeatmap, loadHealth]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadHeatmap();
        loadHealth();
      }, 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadHeatmap, loadHealth]);

  function openThrottle(tenant: TenantThrottle) {
    setEditTenant(tenant);
    setThrottleForm({
      apiMaxRequests: tenant.rateLimit?.apiMaxRequests ?? 300,
      gpsMaxRequests: tenant.rateLimit?.gpsMaxRequests ?? 60,
      active: tenant.rateLimit?.active ?? tenant.active,
      blocked: tenant.rateLimit?.blocked ?? false,
    });
  }

  async function saveThrottle() {
    if (!editTenant) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/throttle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: editTenant.id,
          ...throttleForm,
        }),
      });
      if (res.ok) {
        setSuccess(`Rate limit untuk "${editTenant.name}" berhasil diperbarui`);
        setTimeout(() => setSuccess(''), 3000);
        setEditTenant(null);
        loadTenants();
      }
    } catch {}
    setSaving(false);
  }

  const blockedTenants = tenants.filter((t) => t.rateLimit?.blocked);
  const activeTenants = tenants.filter((t) => (t.rateLimit?.active ?? t.active) && !t.rateLimit?.blocked);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Global Control Tower</h1>
          <p className="text-sm text-[#667085]">Observabilitas real-time seluruh aktivitas logistik platform</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#667085]">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-4 w-4 rounded" />
            Auto-refresh (15s)
          </label>
          <button onClick={loadHeatmap} className={btnGhost}>Refresh</button>
        </div>
      </div>

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Truck size={14} /> Active Drivers
          </div>
          <div className="mt-1 text-2xl font-bold text-[#101828]">{totalPoints}</div>
          {trends.driverTrend !== 0 && (
            <div className={`mt-1 text-[10px] font-semibold ${trends.driverTrend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trends.driverTrend > 0 ? '+' : ''}{trends.driverTrend}% vs jam lalu
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Users size={14} /> Active Tenants
          </div>
          <div className="mt-1 text-2xl font-bold text-[#101828]">{activeTenants.length}</div>
          {trends.tenantTrend !== 0 && (
            <div className="mt-1 text-[10px] font-semibold text-emerald-600">
              +{trends.tenantTrend} sejak periode lalu
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Shield size={14} /> Blocked Tenants
          </div>
          <div className="mt-1 text-2xl font-bold text-red-600">{blockedTenants.length}</div>
          {trends.blockedTrend !== 0 && (
            <div className={`mt-1 text-[10px] font-semibold ${trends.blockedTrend > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {trends.blockedTrend > 0 ? '+' : ''}{trends.blockedTrend} vs jam lalu
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <Activity size={14} /> Heat Points
          </div>
          <div className="mt-1 text-2xl font-bold text-[#101828]">{heatPoints.length}</div>
        </div>
        {/* System Health Card */}
        <div className={`rounded-xl border bg-white p-4 ${
          health && health.apiSuccessRate >= 99 ? 'border-emerald-200' :
          health && health.apiSuccessRate >= 95 ? 'border-amber-200' :
          'border-red-200'
        }`}>
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            {health && health.apiSuccessRate >= 99 ? <CheckCircle size={14} className="text-emerald-500" /> :
             health && health.apiSuccessRate >= 95 ? <AlertTriangle size={14} className="text-amber-500" /> :
             <XCircle size={14} className="text-red-500" />}
            System Health
          </div>
          {health ? (
            <>
              <div className={`mt-1 text-2xl font-bold ${
                health.apiSuccessRate >= 99 ? 'text-emerald-600' :
                health.apiSuccessRate >= 95 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {health.apiSuccessRate}%
              </div>
              <div className="text-[10px] text-[#667085]">API Success Rate</div>
              {health.apiSuccessTrend !== 0 && (
                <div className={`mt-0.5 text-[10px] font-semibold ${health.apiSuccessTrend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {health.apiSuccessTrend > 0 ? '+' : ''}{health.apiSuccessTrend}% vs jam lalu
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
                <div className="text-[#667085]">Requests: <span className="font-semibold text-[#101828]">{health.currentRequests}</span></div>
                <div className="text-[#667085]">Errors: <span className={`font-semibold ${health.currentErrors > 0 ? 'text-red-600' : 'text-[#101828]'}`}>{health.currentErrors}</span></div>
              </div>
            </>
          ) : (
            <div className="mt-2 text-xs text-[#667085]">Memuat...</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* Heatmap */}
        <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white" style={{ height: '500px' }}>
          <GlobalMap center={mapCenter} points={heatPoints} />
        </div>

        {/* Tenant Throttle Panel */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white">
          <div className="border-b border-[#E4E7EC] px-4 py-3">
            <h2 className="text-sm font-bold text-[#101828]">Tenant Rate Limits</h2>
            <p className="text-xs text-[#667085]">Atur kuota API per tenant</p>
          </div>
          <div className="max-h-[450px] overflow-y-auto">
            {tenants.map((t) => {
              const isBlocked = t.rateLimit?.blocked;
              const isDisabled = t.rateLimit?.active === false;
              return (
                <button
                  key={t.id}
                  onClick={() => openThrottle(t)}
                  className={`w-full border-b border-[#E4E7EC] px-4 py-3 text-left transition hover:bg-[#F7F9FC] last:border-0 ${
                    isBlocked ? 'bg-red-50' : isDisabled ? 'bg-gray-50 opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#101828]">{t.name}</div>
                      <div className="text-xs text-[#667085]">/{t.slug}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isBlocked ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          <XCircle size={10} /> Blocked
                        </span>
                      ) : isDisabled ? (
                        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                          Disabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle size={10} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-[#667085]">
                    <span>API: {t.rateLimit?.apiMaxRequests ?? 300}/min</span>
                    <span>GPS: {t.rateLimit?.gpsMaxRequests ?? 60}/min</span>
                  </div>
                </button>
              );
            })}
            {tenants.length === 0 && (
              <div className="py-10 text-center text-sm text-[#667085]">Memuat...</div>
            )}
          </div>
        </div>
      </div>

      {/* Tenant Stats Table */}
      {Object.keys(tenantStats).length > 0 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white">
          <div className="border-b border-[#E4E7EC] px-4 py-3">
            <h2 className="text-sm font-bold text-[#101828]">Tenant Activity (60 menit terakhir)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                  <th className="px-4 py-2 text-left">Tenant</th>
                  <th className="px-4 py-2 text-center">Driver Aktif</th>
                  <th className="px-4 py-2 text-center">GPS Points</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tenantStats)
                  .sort(([, a], [, b]) => b.pointCount - a.pointCount)
                  .map(([tenantId, stat]) => {
                    const tenant = tenants.find((t) => t.id === tenantId);
                    return (
                      <tr key={tenantId} className="border-b border-[#E4E7EC] last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium text-[#101828]">{stat.name}</div>
                        </td>
                        <td className="px-4 py-2 text-center">{stat.driverCount}</td>
                        <td className="px-4 py-2 text-center font-mono">{stat.pointCount}</td>
                        <td className="px-4 py-2 text-center">
                          {tenant?.rateLimit?.blocked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              <AlertTriangle size={10} /> Throttled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <CheckCircle size={10} /> Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Throttle Modal */}
      <Modal open={!!editTenant} title={`Rate Limit: ${editTenant?.name || ''}`} onClose={() => setEditTenant(null)}>
        {editTenant && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#F7F9FC] p-3 text-xs text-[#667085]">
              Atur kuota API untuk tenant <strong>{editTenant.name}</strong>. Jika kuota terlampaui, request akan ditolak (429).
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">API Max Requests / Window</label>
                <input
                  type="number"
                  value={throttleForm.apiMaxRequests}
                  onChange={(e) => setThrottleForm({ ...throttleForm, apiMaxRequests: Number(e.target.value) })}
                  className={inputCls}
                  min={1}
                  max={10000}
                />
                <div className="mt-1 text-[10px] text-[#667085]">Default: 300/menit</div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">GPS Max Requests / Window</label>
                <input
                  type="number"
                  value={throttleForm.gpsMaxRequests}
                  onChange={(e) => setThrottleForm({ ...throttleForm, gpsMaxRequests: Number(e.target.value) })}
                  className={inputCls}
                  min={1}
                  max={10000}
                />
                <div className="mt-1 text-[10px] text-[#667085]">Default: 60/menit</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-[#101828]">
                <input
                  type="checkbox"
                  checked={throttleForm.active}
                  onChange={(e) => setThrottleForm({ ...throttleForm, active: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                Aktif
              </label>
              <label className="flex items-center gap-2 text-sm text-red-600">
                <input
                  type="checkbox"
                  checked={throttleForm.blocked}
                  onChange={(e) => setThrottleForm({ ...throttleForm, blocked: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                <AlertTriangle size={14} />
                Block Semua API
              </label>
            </div>

            {throttleForm.blocked && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <strong>Peringatan:</strong> Semua request API dari tenant ini akan ditolak. Tenant tidak akan bisa mengakses sistem sampai blokir dibuka.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
              <button onClick={() => setEditTenant(null)} className={btnGhost}>Batal</button>
              <button onClick={saveThrottle} disabled={saving} className={btnPrimary}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
