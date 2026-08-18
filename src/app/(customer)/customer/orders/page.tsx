'use client';

import { useEffect, useState } from 'react';
import { Package, MapPin, Plus } from 'lucide-react';

type Order = {
  id: string;
  orderNumber: string;
  destination: string;
  status: string;
  serviceType: string;
  createdAt: string;
  shipmentTrackingNumber: string | null;
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    destination: '', receiverName: '', receiverPhone: '',
    serviceType: 'REGULAR', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  async function fetchOrders() {
    try {
      const res = await fetch('/api/customer/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const createOrder = async () => {
    if (!form.destination || !form.receiverName) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ destination: '', receiverName: '', receiverPhone: '', serviceType: 'REGULAR', notes: '' });
        fetchOrders();
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Pesanan Saya</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
          <Plus size={14} /> Pesanan Baru
        </button>
      </div>

      <div className="space-y-2">
        {orders.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">Belum ada pesanan</div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-sm font-semibold text-blue-600">{o.orderNumber}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                    <MapPin size={12} /> {o.destination}
                  </div>
                  {o.shipmentTrackingNumber && (
                    <div className="mt-1 text-xs text-green-600">Resi: {o.shipmentTrackingNumber}</div>
                  )}
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-2 text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('id-ID')}</div>
            </div>
          ))
        )}
      </div>

      {/* Create Order Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Pesanan Baru</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tujuan *</label>
                <input type="text" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Alamat tujuan" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Penerima *</label>
                <input type="text" value={form.receiverName} onChange={(e) => setForm({ ...form, receiverName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nama penerima" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Telepon Penerima</label>
                <input type="tel" value={form.receiverPhone} onChange={(e) => setForm({ ...form, receiverPhone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="08xxx" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Layanan</label>
                <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="REGULAR">Regular (2-4 hari)</option>
                  <option value="NEXT_DAY">Next Day (1 hari)</option>
                  <option value="SAME_DAY">Same Day</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Catatan</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={2} placeholder="Catatan..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium">Batal</button>
                <button onClick={createOrder} disabled={!form.destination || !form.receiverName || submitting}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {submitting ? 'Membuat...' : 'Buat Pesanan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-gray-50 text-gray-600', CONFIRMED: 'bg-blue-50 text-blue-700',
    FULFILLED: 'bg-green-50 text-green-700', CANCELLED: 'bg-red-50 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-50 text-gray-600'}`}>{status}</span>;
}
