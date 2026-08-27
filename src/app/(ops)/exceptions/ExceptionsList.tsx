"use client";

import { useCallback, useEffect, useState } from 'react';

type Exception = {
  id: string; type: string; severity: string; status: string; title: string; description: string | null;
  dueAt: string | null; resolvedAt: string | null; resolution: string | null;
  createdAt: string;
  shipment: { id: string; trackingNumber: string; destination: string } | null;
  owner: { id: string; name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Terbuka', ASSIGNED: 'Ditugaskan', INVESTIGATING: 'Investigasi',
  ACTION_REQUIRED: 'Perlu Tindakan', RESOLVED: 'Selesai', VERIFIED: 'Terverifikasi',
  CLOSED: 'Tutup', CANCELLED: 'Dibatalkan',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700', ASSIGNED: 'bg-blue-100 text-blue-700',
  INVESTIGATING: 'bg-yellow-100 text-yellow-700', ACTION_REQUIRED: 'bg-orange-100 text-orange-700',
  RESOLVED: 'bg-green-100 text-green-700', VERIFIED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-600', CANCELLED: 'bg-gray-100 text-gray-500',
};
const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const TYPE_LABELS: Record<string, string> = {
  DELIVERY_FAILED: 'Pengiriman Gagal', ADDRESS_UNREACHABLE: 'Alamat Tidak Terjangkau',
  CUSTOMER_UNAVAILABLE: 'Pelanggan Tidak Ada', DAMAGED_GOODS: 'Barang Rusak',
  LOST_PACKAGE: 'Paket Hilang', SLA_BREACH: 'SLA Terlambat',
  VEHICLE_BREAKDOWN: 'Kendaraan Rusak', DRIVER_ISSUE: 'Masalah Driver',
  ROUTE_DEVIATION: 'Rute Menyimpang', WEATHER: 'Cuaca', OTHER: 'Lainnya',
};

export default function ExceptionsList() {
  const [data, setData] = useState<{ exceptions: Exception[]; total: number; totalPages: number; page: number }>({ exceptions: [], total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'DELIVERY_FAILED', severity: 'MEDIUM', title: '', description: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    if (severityFilter) params.set('severity', severityFilter);
    const res = await fetch(`/api/exceptions?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [statusFilter, severityFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function createException(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    if (!res.ok) { setFormError(result.error || 'Gagal'); setSaving(false); return; }
    setShowForm(false);
    setForm({ type: 'DELIVERY_FAILED', severity: 'MEDIUM', title: '', description: '' });
    fetchData();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/exceptions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchData();
  }

  return (
    <div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <h2 className="mb-4 text-lg font-bold text-[#101828]">Exception Baru</h2>
            <form onSubmit={createException} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Tipe</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#667085]">Severity</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Judul *</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#667085]">Deskripsi</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none" />
              </div>
              {formError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm text-[#667085] hover:bg-[#F7F9FC]">Batal</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5] disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Buat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 justify-end">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm focus:border-[#0D6EFD] focus:outline-none">
          <option value="">Semua Severity</option>
          <option value="CRITICAL">Critical</option><option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option><option value="LOW">Low</option>
        </select>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-[#0D6EFD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B5FD5]">
          + Exception Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-[#F7F9FC] text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">PIC</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#667085]">Memuat...</td></tr>
            ) : data.exceptions.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#667085]">Tidak ada exception</td></tr>
            ) : data.exceptions.map((ex) => (
              <tr key={ex.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#101828]">{ex.title}</div>
                  <div className="text-xs text-[#667085]">
                    {TYPE_LABELS[ex.type] || ex.type}
                    {ex.shipment && <span className="ml-1">· {ex.shipment.trackingNumber}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[ex.severity]}`}>{ex.severity}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[ex.status]}`}>{STATUS_LABELS[ex.status]}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[#667085]">{ex.owner?.name || '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {ex.status === 'OPEN' && (
                      <button onClick={() => updateStatus(ex.id, 'INVESTIGATING')} className="text-xs font-medium text-[#0D6EFD] hover:underline">Investigasi</button>
                    )}
                    {['OPEN', 'ASSIGNED', 'INVESTIGATING', 'ACTION_REQUIRED'].includes(ex.status) && (
                      <button onClick={() => updateStatus(ex.id, 'RESOLVED')} className="text-xs font-medium text-emerald-600 hover:underline">Selesai</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E4E7EC] px-4 py-3">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs text-[#667085] disabled:opacity-50">Sebelumnya</button>
            <span className="text-xs text-[#667085]">Halaman {page} / {data.totalPages}</span>
            <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs text-[#667085] disabled:opacity-50">Selanjutnya</button>
          </div>
        )}
      </div>
    </div>
  );
}
