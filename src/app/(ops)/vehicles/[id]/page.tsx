"use client";

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal, Field, inputCls, btnPrimary, btnGhost, EmptyRow } from '@/components/ui';
import { formatNumber, formatDateTime, formatDate, MAINTENANCE_DISTANCE_KM } from '@/lib/constants';
import StatusBadge from '@/components/StatusBadge';

type AssignmentRow = {
  id: string;
  assignedAt: string;
  driver: { id: string; name: string; employeeId: string } | null;
  shipment: {
    trackingNumber: string;
    origin: string;
    destination: string;
    originLat: number | null;
    originLng: number | null;
    destLat: number | null;
    destLng: number | null;
    status: string;
    createdAt: string;
  };
};

type MaintenanceRow = {
  id: string;
  type: string;
  description: string | null;
  cost: number | null;
  odometerKm: number | null;
  notes: string | null;
  performedAt: string;
  createdAt: string;
};

type VehicleCheckRow = {
  id: string;
  answers: Record<string, 'ok' | 'issue'>;
  issues: string[];
  hasIssue: boolean;
  notes: string | null;
  checkedAt: string;
  driver: { id: string; name: string; employeeId: string };
  warehouse: { id: string; name: string; code: string | null };
};

type VehicleDetail = {
  id: string;
  vehicleNumber: string;
  type: string;
  capacity: number;
  status: string;
  totalDistanceKm: number;
  photoFront: string | null;
  photoBack: string | null;
  photoRight: string | null;
  photoLeft: string | null;
  returning: boolean;
  maintenanceRecords: MaintenanceRow[];
  vehicleChecks: VehicleCheckRow[];
  assignments: AssignmentRow[];
};

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-[#E6F9EF] text-[#16B364]',
  IN_USE: 'bg-[#FFF2E0] text-[#FF8A00]',
  MAINTENANCE: 'bg-[#FEF0F0] text-[#F5222D]',
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Tersedia',
  IN_USE: 'Digunakan',
  MAINTENANCE: 'Perawatan',
};

const MAINT_TYPES = [
  'Servis Rutin',
  'Ganti Oli',
  'Ganti Ban',
  'Perbaikan Mesin',
  'Perbaikan Body',
  'Aki / Kelistrikan',
  'Rem / Kopling',
  'Lainnya',
];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [v, setV] = useState<VehicleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [maintOpen, setMaintOpen] = useState(false);
  const [form, setForm] = useState({ type: MAINT_TYPES[0], description: '', cost: '', odometerKm: '', notes: '', performedAt: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/vehicles/${id}`);
    if (!res.ok) {
      setErr('Kendaraan tidak ditemukan');
      setLoading(false);
      return;
    }
    setV(await res.json());
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function addMaintenance(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch(`/api/vehicles/${id}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        performedAt: form.performedAt ? new Date(form.performedAt).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setMsg(data.error || 'Gagal menyimpan');
    setMaintOpen(false);
    setForm({ type: MAINT_TYPES[0], description: '', cost: '', odometerKm: '', notes: '', performedAt: '' });
    await load();
  }

  if (loading) return <div className="py-20 text-center text-[#667085]">Memuat...</div>;
  if (err || !v) return <div className="py-20 text-center text-sm text-[#F5222D]">{err || 'Tidak ditemukan'}</div>;

  const photos = [
    { label: 'Depan', src: v.photoFront },
    { label: 'Belakang', src: v.photoBack },
    { label: 'Samping Kanan', src: v.photoRight },
    { label: 'Samping Kiri', src: v.photoLeft },
  ].filter((p) => p.src);

  const lastMaintenance = v.maintenanceRecords[0] || null;
  const pct = Math.min(100, ((v.totalDistanceKm || 0) / MAINTENANCE_DISTANCE_KM) * 100);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/vehicles" className="text-xs font-semibold text-[#0D6EFD] hover:underline">← Kembali</Link>
          <div>
            <h1 className="text-xl font-bold text-[#101828]">{v.vehicleNumber}</h1>
            <p className="text-sm text-[#667085]">{v.type} · {formatNumber(v.capacity)} kg</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {v.returning && <span className="rounded-full bg-[#FFF7E6] px-2 py-0.5 text-xs font-semibold text-[#FF8A00]">Kembali ke Gudang</span>}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[v.status] || 'bg-[#F7F9FC] text-[#667085]'}`}>
            {STATUS_LABEL[v.status] || v.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold text-[#101828]">Data Kendaraan</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#E4E7EC] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[#667085]">Status Kendaraan</div>
              <div className="mt-1 text-sm font-bold text-[#101828]">{STATUS_LABEL[v.status] || v.status}</div>
            </div>
            <div className="rounded-lg border border-[#E4E7EC] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[#667085]">Total Jarak Tempuh</div>
              <div className="mt-1 text-sm font-bold text-[#101828]">{formatNumber(Math.round(v.totalDistanceKm || 0))} km</div>
            </div>
            <div className="rounded-lg border border-[#E4E7EC] p-3 sm:col-span-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className={v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM ? 'font-semibold text-[#F5222D]' : 'text-[#667085]'}>
                  Siklus perawatan ({formatNumber(MAINTENANCE_DISTANCE_KM)} km)
                </span>
                <span className="text-[#667085]">{Math.round(pct)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F7F9FC]">
                <div
                  className={`h-full rounded-full ${v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM ? 'bg-[#F5222D]' : v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM * 0.8 ? 'bg-[#FF8A00]' : 'bg-[#16B364]'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {v.totalDistanceKm >= MAINTENANCE_DISTANCE_KM && (
                <div className="mt-1 text-[11px] font-bold text-[#F5222D]">⚠ Perlu Perawatan</div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-[#667085]">Foto Kendaraan</div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p) => (
                  <div key={p.label} className="group relative">
                    <img src={p.src!} alt={p.label} className="h-24 w-full rounded-lg border border-[#E4E7EC] object-cover" />
                    <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/50 px-1 py-0.5 text-center text-[10px] text-white">{p.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#667085]">Belum ada foto</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 text-sm font-bold text-[#101828]">Ringkasan Perawatan</h2>
          <div className="space-y-3">
            <div className="rounded-lg bg-[#F7F9FC] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[#667085]">Riwayat Perawatan</div>
              <div className="mt-1 text-sm font-bold text-[#101828]">{v.maintenanceRecords.length} catatan</div>
            </div>
            <div className="rounded-lg bg-[#F7F9FC] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[#667085]">Perawatan Terakhir</div>
              <div className="mt-1 text-sm font-bold text-[#101828]">{lastMaintenance ? lastMaintenance.type : '-'}</div>
              <div className="text-[11px] text-[#667085]">{lastMaintenance ? formatDate(lastMaintenance.performedAt) : ''}</div>
            </div>
            <button onClick={() => { setMaintOpen(true); setMsg(''); }} className={btnPrimary + ' w-full'}>+ Catat Perawatan</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 text-sm font-bold text-[#101828]">Riwayat Pemeliharaan ({v.maintenanceRecords.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Biaya</th>
              </tr>
            </thead>
            <tbody>
              {v.maintenanceRecords.map((m) => (
                <tr key={m.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 text-xs text-[#667085]">{formatDateTime(m.performedAt)}</td>
                  <td className="px-4 py-3 font-medium text-[#101828]">{m.type}</td>
                  <td className="px-4 py-3 text-[#667085]">
                    {m.description || '-'}
                    {m.notes && <div className="text-[11px] text-[#667085]">{m.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{m.odometerKm != null ? `${formatNumber(Math.round(m.odometerKm))} km` : '-'}</td>
                  <td className="px-4 py-3 text-[#667085]">{m.cost != null ? `Rp ${formatNumber(m.cost)}` : '-'}</td>
                </tr>
              ))}
              {v.maintenanceRecords.length === 0 && <EmptyRow colSpan={5} text="Belum ada riwayat pemeliharaan" />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 text-sm font-bold text-[#101828]">Ceklist Pasca Perjalanan ({v.vehicleChecks.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Gudang</th>
                <th className="px-4 py-3">Hasil</th>
                <th className="px-4 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {v.vehicleChecks.map((c) => (
                <tr key={c.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                  <td className="px-4 py-3 text-xs text-[#667085]">{formatDateTime(c.checkedAt)}</td>
                  <td className="px-4 py-3 text-[#101828]">{c.driver.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{c.warehouse.name} ({c.warehouse.code || '-'})</td>
                  <td className="px-4 py-3">
                    {c.hasIssue ? (
                      <span className="rounded-full bg-[#FEF0F0] px-2 py-0.5 text-xs font-semibold text-[#F5222D]">Ada Masalah</span>
                    ) : (
                      <span className="rounded-full bg-[#E6F9EF] px-2 py-0.5 text-xs font-semibold text-[#16B364]">Normal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{c.notes || '-'}</td>
                </tr>
              ))}
              {v.vehicleChecks.length === 0 && <EmptyRow colSpan={5} text="Belum ada ceklist pasca perjalanan" />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 text-sm font-bold text-[#101828]">Riwayat Perjalanan ({v.assignments.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F9FC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                <th className="px-4 py-3">No. Resi</th>
                <th className="px-4 py-3">Rute</th>
                <th className="px-4 py-3">Jarak (garis lurus)</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Tanggal Tugas</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {v.assignments.map((a) => {
                const dist =
                  a.shipment.originLat != null && a.shipment.originLng != null && a.shipment.destLat != null && a.shipment.destLng != null
                    ? haversineKm(a.shipment.originLat, a.shipment.originLng, a.shipment.destLat, a.shipment.destLng)
                    : null;
                return (
                  <tr key={a.id} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#F7F9FC]/50">
                    <td className="px-4 py-3">
                      <Link href={`/shipments/${a.shipment.trackingNumber}`} className="font-mono text-xs font-semibold text-[#0D6EFD] hover:underline">
                        {a.shipment.trackingNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#667085]">{a.shipment.origin} → {a.shipment.destination}</td>
                    <td className="px-4 py-3 text-[#667085]">{dist != null ? `${dist.toFixed(1)} km` : '-'}</td>
                    <td className="px-4 py-3 text-[#667085]">{a.driver ? a.driver.name : '-'}</td>
                    <td className="px-4 py-3 text-xs text-[#667085]">{formatDate(a.assignedAt)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.shipment.status} /></td>
                  </tr>
                );
              })}
              {v.assignments.length === 0 && <EmptyRow colSpan={6} text="Belum ada riwayat perjalanan" />}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={maintOpen} title="Catat Perawatan Kendaraan" onClose={() => setMaintOpen(false)}>
        <form onSubmit={addMaintenance} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis Perawatan" required>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                {MAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Tanggal">
              <input type="date" value={form.performedAt} onChange={(e) => setForm({ ...form, performedAt: e.target.value })} className={inputCls} />
            </Field>
            <div className="col-span-2">
              <Field label="Keterangan">
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="mis. ganti oli mesin & filter" />
              </Field>
            </div>
            <Field label="Odometer (km)">
              <input type="number" min={0} value={form.odometerKm} onChange={(e) => setForm({ ...form, odometerKm: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Biaya (Rp)">
              <input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className={inputCls} />
            </Field>
            <div className="col-span-2">
              <Field label="Catatan">
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
              </Field>
            </div>
          </div>
          {msg && <div className="rounded-lg bg-[#FEF0F0] px-3 py-2 text-sm text-[#F5222D]">{msg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setMaintOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
