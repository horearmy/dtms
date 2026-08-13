"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import { EmptyRow, btnPrimary, inputCls } from '@/components/ui';
import { formatNumber, formatDateTime, STATUS_LABELS } from '@/lib/constants';

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Memuat...</div>}>
      <ShipmentsInner />
    </Suspense>
  );
}

type Shipment = {
  id: string;
  trackingNumber: string;
  origin: string;
  destination: string;
  weight: number;
  serviceType: string;
  status: string;
  createdAt: string;
  sender: { name: string };
  receiver: { name: string };
  assignments: { driver: { name: string }; vehicle: { vehicleNumber: string } | null }[];
};

const STATUS_FILTERS = [
  'SEMUA',
  'ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'WAREHOUSE_RECEIVED', 'SORTING',
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'DELIVERY_FAILED', 'RESCHEDULED', 'RETURNED',
];

function ShipmentsInner() {
  const params = useSearchParams();
  const [items, setItems] = useState<Shipment[]>([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('SEMUA');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/shipments?q=${encodeURIComponent(q)}${status !== 'SEMUA' ? `&status=${status}` : ''}`;
    const res = await fetch(url);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Shipment</h1>
          <p className="text-sm text-slate-500">Manajemen pengiriman ({items.length} data)</p>
        </div>
        <Link href="/shipments/new" className={btnPrimary}>+ Buat Shipment</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari resi / nama / tujuan..."
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls + ' w-auto'}>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s === 'SEMUA' ? 'Semua Status' : STATUS_LABELS[s] || s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">No. Resi</th>
                <th className="px-4 py-3">Pengirim</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3">Tujuan</th>
                <th className="px-4 py-3">Berat</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">Memuat...</td></tr>
              )}
              {!loading && items.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/shipments/${s.id}`} className="font-mono text-xs font-semibold text-brand-600 hover:underline">{s.trackingNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.sender.name}</td>
                  <td className="px-4 py-3 text-slate-700">{s.receiver.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.destination}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(s.weight)} kg</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.serviceType}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{s.assignments[0]?.driver.name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && <EmptyRow colSpan={9} text="Tidak ada shipment yang cocok" />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}