"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Kpi = {
  totalShipments: number; activeShipments: number; deliveredToday: number; failedToday: number;
  slaBreaches: number; slaAtRisk: number; slaOnTrack: number; onTimeRate: number;
};
type Resources = { activeDrivers: number; totalDrivers: number; activeVehicles: number; totalVehicles: number };
type Alerts = { openExceptions: number; criticalExceptions: number };
type Event = { id: string; eventType: string; occurredAt: string; trackingNumber: string };

const EVENT_LABELS: Record<string, string> = {
  SHIPMENT_CREATED: 'Dibuat', WAREHOUSE_RECEIVED: 'Di Gudang', SORTED: 'Sorted',
  ASSIGNED: 'Ditugaskan', DISPATCHED: 'Dikirim', ARRIVED_HUB: 'Tiba Hub',
  OUT_FOR_DELIVERY: 'Diantar', DELIVERED: 'Terkirim', DELIVERY_FAILED: 'Gagal',
  POD_SUBMITTED: 'POD Dikirim', COMPLETED: 'Selesai',
};
const EVENT_COLORS: Record<string, string> = {
  DELIVERED: 'bg-green-100 text-green-700', DISPATCHED: 'bg-cyan-100 text-cyan-700',
  DELIVERY_FAILED: 'bg-red-100 text-red-700', OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  WAREHOUSE_RECEIVED: 'bg-yellow-100 text-yellow-700', ASSIGNED: 'bg-purple-100 text-purple-700',
};

export default function ControlTower() {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [resources, setResources] = useState<Resources | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 30000); return () => clearInterval(interval); }, []);

  async function fetchData() {
    const res = await fetch('/api/control-tower');
    if (res.ok) {
      const data = await res.json();
      setKpi(data.kpi);
      setResources(data.resources);
      setAlerts(data.alerts);
      setEvents(data.recentEvents);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center py-8 text-[#667085]">Memuat Control Tower...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active Deliveries" value={kpi?.activeShipments || 0} color="text-blue-600" />
        <KpiCard label="Delivered Today" value={kpi?.deliveredToday || 0} color="text-green-600" />
        <KpiCard label="On-Time Rate" value={`${kpi?.onTimeRate || 100}%`} color="text-emerald-600" />
        <KpiCard label="Failed Today" value={kpi?.failedToday || 0} color="text-red-600" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="SLA On Track" value={kpi?.slaOnTrack || 0} color="text-emerald-600" />
        <KpiCard label="SLA At Risk" value={kpi?.slaAtRisk || 0} color="text-amber-600" />
        <KpiCard label="SLA Breaches" value={kpi?.slaBreaches || 0} color="text-red-600" />
        <KpiCard label="Open Exceptions" value={alerts?.openExceptions || 0} color="text-orange-600" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Drivers Active" value={`${resources?.activeDrivers || 0}/${resources?.totalDrivers || 0}`} color="text-[#101828]" />
        <KpiCard label="Vehicles In Use" value={`${resources?.activeVehicles || 0}/${resources?.totalVehicles || 0}`} color="text-[#101828]" />
        <KpiCard label="Critical Exceptions" value={alerts?.criticalExceptions || 0} color="text-red-700" />
        <KpiCard label="Total Shipments" value={kpi?.totalShipments || 0} color="text-[#101828]" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#667085]">Recent Events</h2>
            <Link href="/tracking" className="text-xs font-medium text-[#0D6EFD] hover:underline">Lihat Semua</Link>
          </div>
          <div className="space-y-2">
            {events.length === 0 && <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center text-[#667085]">Tidak ada event</div>}
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${EVENT_COLORS[e.eventType] || 'bg-gray-100 text-gray-600'}`}>
                  {EVENT_LABELS[e.eventType] || e.eventType}
                </span>
                <span className="text-sm font-medium text-[#0D6EFD]">{e.trackingNumber}</span>
                <span className="ml-auto text-xs text-[#667085]">{new Date(e.occurredAt).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#667085]">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/dispatch" className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC]">
              <div className="text-sm font-semibold text-[#101828]">Dispatch Board</div>
              <div className="mt-1 text-xs text-[#667085]">Tugaskan driver & kendaraan</div>
            </Link>
            <Link href="/exceptions" className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC]">
              <div className="text-sm font-semibold text-[#101828]">Exceptions</div>
              <div className="mt-1 text-xs text-[#667085]">Kelola masalah pengiriman</div>
            </Link>
            <Link href="/map" className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC]">
              <div className="text-sm font-semibold text-[#101828]">Live Map</div>
              <div className="mt-1 text-xs text-[#667085]">Pantau posisi driver</div>
            </Link>
            <Link href="/reports" className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#F7F9FC]">
              <div className="text-sm font-semibold text-[#101828]">Laporan</div>
              <div className="mt-1 text-xs text-[#667085]">Analitik & export</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="text-xs font-medium text-[#667085]">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
