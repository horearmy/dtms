'use client';

import { useEffect, useState } from 'react';
import { MapPin, Package } from 'lucide-react';

type Shipment = {
  id: string;
  trackingNumber: string;
  destination: string;
  origin: string;
  status: string;
  serviceType: string;
  updatedAt: string;
  receiverName: string | null;
};

export default function CustomerShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered'>('all');

  useEffect(() => { fetchShipments(); }, []);

  async function fetchShipments() {
    try {
      const res = await fetch('/api/customer/shipments');
      if (res.ok) {
        const data = await res.json();
        setShipments(data.shipments || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const filtered = shipments.filter((s) => {
    if (filter === 'active') return ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status);
    if (filter === 'delivered') return s.status === 'DELIVERED';
    return true;
  });

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="mb-4 text-lg font-bold text-gray-900">Pengiriman Saya</h1>

      <div className="mb-4 flex gap-2">
        {['all', 'active', 'delivered'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            {f === 'all' ? 'Semua' : f === 'active' ? 'Aktif' : 'Selesai'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">Tidak ada pengiriman</div>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-sm font-semibold text-blue-600">{s.trackingNumber}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                    <MapPin size={12} /> {s.destination}
                  </div>
                  {s.receiverName && <div className="mt-1 text-xs text-gray-400">Penerima: {s.receiverName}</div>}
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1"><Package size={10} /> {s.serviceType}</span>
                <span>{new Date(s.updatedAt).toLocaleString('id-ID')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DISPATCHED: 'bg-cyan-50 text-cyan-700', IN_TRANSIT: 'bg-blue-50 text-blue-700',
    OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-700', DELIVERED: 'bg-green-50 text-green-700',
    DELIVERY_FAILED: 'bg-red-50 text-red-700', ORDER_CREATED: 'bg-gray-50 text-gray-600',
  };
  const labels: Record<string, string> = {
    DISPATCHED: 'Dikirim', IN_TRANSIT: 'Transit', OUT_FOR_DELIVERY: 'Diantar',
    DELIVERED: 'Selesai', DELIVERY_FAILED: 'Gagal', ORDER_CREATED: 'Dibuat',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>{labels[status] || status}</span>;
}
