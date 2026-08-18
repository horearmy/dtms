"use client";

import { useEffect, useState } from 'react';

type Shipment = { id: string; trackingNumber: string; origin: string; destination: string; status: string; weight: number; slaDeadline: string | null; createdAt: string };
type Driver = { id: string; employeeId: string; name: string; phone: string; status: string };
type Vehicle = { id: string; vehicleNumber: string; type: string; capacity: number; status: string };
type Assignment = {
  id: string; assignedAt: string;
  shipment: { id: string; trackingNumber: string; destination: string; status: string };
  driver: { id: string; name: string; employeeId: string };
  vehicle: { id: string; vehicleNumber: string; type: string; capacity: number } | null;
};

const STATUS_LABELS: Record<string, string> = {
  WAREHOUSE_RECEIVED: 'Di Gudang', SORTING: 'Sorting', ORDER_CREATED: 'Dibuat',
  DISPATCHED: 'Dikirim', IN_TRANSIT: 'Dalam Perjalanan', OUT_FOR_DELIVERY: 'Diantar',
  DELIVERED: 'Terkirim', DELIVERY_FAILED: 'Gagal',
};

const STATUS_COLORS: Record<string, string> = {
  WAREHOUSE_RECEIVED: 'bg-yellow-100 text-yellow-700', SORTING: 'bg-purple-100 text-purple-700',
  ORDER_CREATED: 'bg-blue-100 text-blue-700', DISPATCHED: 'bg-cyan-100 text-cyan-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700', OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
};

export default function DispatchBoard() {
  const [data, setData] = useState<{ unassignedShipments: Shipment[]; availableDrivers: Driver[]; availableVehicles: Vehicle[]; activeAssignments: Assignment[] }>({ unassignedShipments: [], availableDrivers: [], availableVehicles: [], activeAssignments: [] });
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const res = await fetch('/api/dispatch');
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  async function assign(shipmentId: string) {
    if (!selectedDriver) { setError('Pilih driver terlebih dahulu'); return; }
    setAssigning(shipmentId);
    setError('');
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId, driverId: selectedDriver, vehicleId: selectedVehicle || null }),
    });
    const result = await res.json();
    if (!res.ok) { setError(result.error || 'Gagal menugaskan'); setAssigning(null); return; }
    setSelectedDriver('');
    setSelectedVehicle('');
    setAssigning(null);
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Menunggu Dispatch</div>
          <div className="mt-1 text-3xl font-bold text-[#101828]">{data.unassignedShipments.length}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Driver Tersedia</div>
          <div className="mt-1 text-3xl font-bold text-emerald-600">{data.availableDrivers.length}</div>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="text-sm text-[#667085]">Kendaraan Tersedia</div>
          <div className="mt-1 text-3xl font-bold text-blue-600">{data.availableVehicles.length}</div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#667085]">Menunggu Dispatch</h2>
          {loading ? (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center text-[#667085]">Memuat...</div>
          ) : data.unassignedShipments.length === 0 ? (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center text-[#667085]">Tidak ada pengiriman menunggu</div>
          ) : (
            <div className="space-y-3">
              {data.unassignedShipments.map((s) => (
                <div key={s.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-[#0D6EFD]">{s.trackingNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </div>
                  <div className="mb-3 text-sm text-[#667085]">
                    {s.origin} → {s.destination} · {s.weight} kg
                    {s.slaDeadline && <span className="ml-2 text-amber-600">SLA: {new Date(s.slaDeadline).toLocaleDateString('id-ID')}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)}
                      className="flex-1 rounded-lg border border-[#E4E7EC] px-2 py-1.5 text-sm focus:border-[#0D6EFD] focus:outline-none">
                      <option value="">Pilih Driver</option>
                      {data.availableDrivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>
                      ))}
                    </select>
                    <select value={selectedVehicle} onChange={(e) => setSelectedVehicle(e.target.value)}
                      className="w-40 rounded-lg border border-[#E4E7EC] px-2 py-1.5 text-sm focus:border-[#0D6EFD] focus:outline-none">
                      <option value="">Tanpa Kendaraan</option>
                      {data.availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.capacity}kg)</option>
                      ))}
                    </select>
                    <button onClick={() => assign(s.id)} disabled={assigning === s.id}
                      className="rounded-lg bg-[#0D6EFD] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
                      {assigning === s.id ? '...' : 'Tugaskan'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#667085]">Active Dispatches</h2>
          {data.activeAssignments.length === 0 ? (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 text-center text-[#667085]">Tidak ada dispatch aktif</div>
          ) : (
            <div className="space-y-3">
              {data.activeAssignments.map((a) => (
                <div key={a.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-[#0D6EFD]">{a.shipment.trackingNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[a.shipment.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[a.shipment.status] || a.shipment.status}
                    </span>
                  </div>
                  <div className="text-sm text-[#667085]">{a.shipment.destination}</div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-[#667085]">
                    <span>Driver: <span className="font-medium text-[#101828]">{a.driver.name}</span></span>
                    {a.vehicle && <span>Kendaraan: <span className="font-medium text-[#101828]">{a.vehicle.vehicleNumber}</span></span>}
                    <span>{new Date(a.assignedAt).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
