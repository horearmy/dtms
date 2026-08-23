"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { EmptyRow, btnPrimary, inputCls } from '@/components/ui';
import { formatNumber, formatDateTime, STATUS_LABELS } from '@/lib/constants';

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[#667085]">Memuat...</div>}>
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
  stops?: unknown[];
  DeliveryAssignment: { driver: { name: string }; vehicle: { vehicleNumber: string } | null }[];
};

const STATUS_FILTERS = [
  'SEMUA',
  'ORDER_CREATED', 'WAREHOUSE_RECEIVED',
  'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'DELIVERY_FAILED', 'RESCHEDULED', 'RETURNED',
];

function ShipmentsInner() {
  const params = useSearchParams();
  const [items, setItems] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('SEMUA');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/shipments?q=${encodeURIComponent(q)}${status !== 'SEMUA' ? `&status=${status}` : ''}&page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [q, status, page]);

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Shipment</h1>
          <p className="text-sm text-[#667085]">Manajemen pengiriman ({total} data)</p>
        </div>
        <Link href="/shipments/new" className={btnPrimary}>+ Buat Shipment</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari resi / nama / tujuan..."
          className="min-w-[220px] flex-1 rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm focus:border-[#0D6EFD] focus:ring-1 focus:ring-[#0D6EFD] focus:outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls + ' w-auto'}>
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s === 'SEMUA' ? 'Semua Status' : STATUS_LABELS[s] || s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
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
                <tr><td colSpan={9} className="py-8 text-center text-[#667085]">Memuat...</td></tr>
              )}
              {!loading && items.map((s) => (
                <tr key={s.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3">
                    <Link href={`/shipments/${s.id}`} className="font-mono text-xs font-semibold text-[#0D6EFD] hover:underline">{s.trackingNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#101828]">{s.sender.name}</td>
                  <td className="px-4 py-3 text-[#101828]">{s.receiver.name}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {s.destination}
                    {(s.stops?.length || 0) > 2 && (
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">multi-stop · {s.stops?.length} titik</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{formatNumber(s.weight)} kg</td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{s.serviceType}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-[#667085]">{s.DeliveryAssignment[0]?.driver.name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-[#667085]">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && <EmptyRow colSpan={9} text="Tidak ada shipment yang cocok" />}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </div>
    </div>
  );
}
