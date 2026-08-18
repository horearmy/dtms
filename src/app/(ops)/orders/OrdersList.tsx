"use client";

import { useEffect, useState } from 'react';

type OrderItem = { id: string; itemName: string; quantity: number; weight: number | null; dimension: string | null };
type Order = {
  id: string; orderNumber: string; source: string; status: string;
  customerName: string; customerPhone: string;
  destName: string; destAddress: string; destCity: string | null;
  serviceType: string; weight: number;
  slaDeadline: string | null; createdAt: string;
  items: OrderItem[];
  shipment: { id: string; trackingNumber: string; status: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', RECEIVED: 'Diterima', VALIDATING: 'Validasi', VALIDATED: 'Valid',
  REJECTED: 'Ditolak', CONFIRMED: 'Dikonfirmasi', CANCELLED: 'Dibatalkan', FULFILLED: 'Selesai',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', RECEIVED: 'bg-blue-100 text-blue-700',
  VALIDATING: 'bg-yellow-100 text-yellow-700', VALIDATED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700', CONFIRMED: 'bg-indigo-100 text-indigo-700',
  CANCELLED: 'bg-red-100 text-red-700', FULFILLED: 'bg-green-100 text-green-700',
};
const SERVICE_LABELS: Record<string, string> = {
  SAME_DAY: 'Same Day', NEXT_DAY: 'Next Day', REGULAR: 'Reguler',
};

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    destName: '', destAddress: '', destCity: '',
    serviceType: 'REGULAR', weight: '', fragile: false, notes: '',
  });

  useEffect(() => { fetchOrders(); }, [statusFilter, page, search]);

  async function fetchOrders() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('q', search);
    const res = await fetch(`/api/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, weight: parseFloat(form.weight) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Gagal membuat order'); setSaving(false); return; }
      setShowForm(false);
      setForm({ customerName: '', customerPhone: '', customerEmail: '', destName: '', destAddress: '', destCity: '', serviceType: 'REGULAR', weight: '', fragile: false, notes: '' });
      fetchOrders();
    } catch {
      setFormError('Terjadi kesalahan');
    }
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    const body: Record<string, string> = { status };
    if (status === 'CANCELLED') {
      const reason = prompt('Alasan pembatalan:');
      if (reason === null) return;
      body.cancelReason = reason;
    }
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchOrders();
  }

  const paged = orders;

  return (
    <div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="mb-4 text-lg font-bold text-[#101828]">Order Baru</h2>
            <form onSubmit={createOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Nama Pelanggan *</label>
                  <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Telepon *</label>
                  <input required value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Nama Penerima *</label>
                <input required value={form.destName} onChange={(e) => setForm({ ...form, destName: e.target.value })}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Alamat Tujuan *</label>
                  <input required value={form.destAddress} onChange={(e) => setForm({ ...form, destAddress: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Kota Tujuan</label>
                  <input value={form.destCity} onChange={(e) => setForm({ ...form, destCity: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Layanan</label>
                  <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="SAME_DAY">Same Day</option>
                    <option value="NEXT_DAY">Next Day</option>
                    <option value="REGULAR">Reguler</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Berat (kg) *</label>
                  <input type="number" step="0.1" min="0.1" required value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm">
                    <input type="checkbox" checked={form.fragile} onChange={(e) => setForm({ ...form, fragile: e.target.checked })} className="rounded" />
                    Rapuh
                  </label>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Catatan</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
              </div>
              {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm text-[#667085] hover:bg-[#F7F9FC]">Batal</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Buat Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 justify-end">
        <input type="text" placeholder="Cari order..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-48 rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5]">
          + Order Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
              <th className="px-4 py-3">No. Order</th>
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Tujuan</th>
              <th className="px-4 py-3">Layanan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#667085]">Memuat...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#667085]">Belum ada order</td></tr>
            ) : paged.map((o) => (
              <tr key={o.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                <td className="px-4 py-3 font-medium text-[#0D6EFD]">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-[#101828]">{o.customerName}</div>
                  <div className="text-xs text-[#667085]">{o.customerPhone}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[#101828]">{o.destName}</div>
                  <div className="text-xs text-[#667085]">{o.destCity || o.destAddress}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[#F7F9FC] px-2 py-0.5 text-xs font-medium text-[#667085]">
                    {SERVICE_LABELS[o.serviceType] || o.serviceType} · {o.weight} kg
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                  {o.shipment && (
                    <div className="mt-1 text-xs text-[#0D6EFD]">→ {o.shipment.trackingNumber}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {o.status === 'RECEIVED' && (
                      <>
                        <button onClick={() => updateStatus(o.id, 'CONFIRMED')} className="text-xs font-medium text-emerald-600 hover:underline">Konfirmasi</button>
                        <button onClick={() => updateStatus(o.id, 'CANCELLED')} className="text-xs font-medium text-red-600 hover:underline">Tolak</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E4E7EC] px-4 py-3">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs text-[#667085] hover:bg-[#F7F9FC] disabled:opacity-50">Sebelumnya</button>
            <span className="text-xs text-[#667085]">Halaman {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs text-[#667085] hover:bg-[#F7F9FC] disabled:opacity-50">Selanjutnya</button>
          </div>
        )}
      </div>
    </div>
  );
}
