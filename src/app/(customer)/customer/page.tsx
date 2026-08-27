'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, MapPin, CheckCircle, Truck } from 'lucide-react';

type ShipmentSummary = {
  id: string;
  trackingNumber: string;
  destination: string;
  status: string;
  updatedAt: string;
};

export default function CustomerDashboard() {
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShipments();
  }, []);

  async function fetchShipments() {
    try {
      const res = await fetch('/api/customer/shipments');
      if (res.ok) {
        const data = await res.json();
        setShipments(data.shipments || []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  const active = shipments.filter((s) => ['DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(s.status));
  const delivered = shipments.filter((s) => s.status === 'DELIVERED');

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
        <div className="text-sm opacity-80">Selamat Datang</div>
        <div className="text-xl font-bold">Customer Portal</div>
        <div className="mt-2 flex items-center gap-4 text-sm opacity-90">
          <span className="flex items-center gap-1"><Package size={14} /> {shipments.length} pengiriman</span>
          <span className="flex items-center gap-1"><Truck size={14} /> {active.length} aktif</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={<Truck size={18} />} label="Aktif" value={active.length} color="bg-blue-50 text-blue-600" />
        <StatCard icon={<CheckCircle size={18} />} label="Selesai" value={delivered.length} color="bg-green-50 text-green-600" />
        <StatCard icon={<Package size={18} />} label="Total" value={shipments.length} color="bg-gray-50 text-gray-600" />
      </div>

      {/* Track by Number */}
      <div className="mb-6">
        <Link href="/track" className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <MapPin size={18} className="text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Lacak Pengiriman</div>
              <div className="text-xs text-gray-500">Masukkan nomor resi</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Shipments */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Pengiriman Terbaru</h2>
        {shipments.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
            Belum ada pengiriman
          </div>
        ) : (
          <div className="space-y-2">
            {shipments.slice(0, 10).map((s) => (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-sm font-semibold text-blue-600">{s.trackingNumber}</div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                      <MapPin size={12} /> {s.destination}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {new Date(s.updatedAt).toLocaleString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
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
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  );
}
