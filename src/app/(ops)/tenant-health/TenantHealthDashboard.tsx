"use client";

import { useEffect, useState } from 'react';

type Tenant = { id: string; name: string; slug: string; status: string; active: boolean };
type HealthData = {
  tenant: { id: string; name: string; status: string; active: boolean };
  healthScore: number;
  usage: { users: number; drivers: number; shipments: number; vehicles: number; customers: number };
  activity: { shipments30d: number; shipments7d: number; openExceptions: number };
  metrics: Record<string, { latest: number; avg: number; trend: number }>;
};

export default function TenantHealthDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/tenants').then(r => r.json()).then(d => { if (Array.isArray(d)) setTenants(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) { setHealth(null); return; }
    setLoading(true);
    setError('');
    fetch(`/api/tenants/${selectedId}/health`)
      .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); })
      .then(setHealth)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedId]);

  function scoreColor(s: number) {
    if (s >= 80) return 'text-green-600 bg-green-50';
    if (s >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Pilih Tenant</label>
        <select className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">-- Pilih Tenant --</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>)}
        </select>
      </div>

      {loading && <div className="text-sm text-[#667085]">Memuat data kesehatan...</div>}
      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {health && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className={`rounded-xl border p-5 text-center ${scoreColor(health.healthScore)}`}>
              <div className="text-3xl font-bold">{health.healthScore}</div>
              <div className="mt-1 text-xs font-medium">Health Score</div>
            </div>
            <div className="rounded-xl border bg-white p-5 text-center shadow-sm">
              <div className="text-2xl font-bold text-[#101828]">{health.usage.users}</div>
              <div className="mt-1 text-xs text-[#667085]">Pengguna</div>
            </div>
            <div className="rounded-xl border bg-white p-5 text-center shadow-sm">
              <div className="text-2xl font-bold text-[#101828]">{health.usage.drivers}</div>
              <div className="mt-1 text-xs text-[#667085]">Driver</div>
            </div>
            <div className="rounded-xl border bg-white p-5 text-center shadow-sm">
              <div className="text-2xl font-bold text-[#101828]">{health.usage.shipments}</div>
              <div className="mt-1 text-xs text-[#667085]">Shipment</div>
            </div>
            <div className="rounded-xl border bg-white p-5 text-center shadow-sm">
              <div className="text-2xl font-bold text-[#101828]">{health.activity.openExceptions}</div>
              <div className="mt-1 text-xs text-[#667085]">Open Exceptions</div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-[#101828]">Aktivitas Pengiriman</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-[#667085]">7 Hari Terakhir</div>
                <div className="mt-1 text-xl font-bold text-[#101828]">{health.activity.shipments7d}</div>
              </div>
              <div>
                <div className="text-sm text-[#667085]">30 Hari Terakhir</div>
                <div className="mt-1 text-xl font-bold text-[#101828]">{health.activity.shipments30d}</div>
              </div>
            </div>
          </div>

          {Object.keys(health.metrics).length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-[#101828]">Metrik Tenant</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(health.metrics).map(([key, m]) => (
                  <div key={key} className="rounded-lg border p-3">
                    <div className="text-xs font-medium uppercase text-[#667085]">{key}</div>
                    <div className="mt-1 text-lg font-bold text-[#101828]">{m.latest}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs">
                      <span className={m.trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {m.trend >= 0 ? '↑' : '↓'} {Math.abs(m.trend)}%
                      </span>
                      <span className="text-[#667085]">vs minggu lalu</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
