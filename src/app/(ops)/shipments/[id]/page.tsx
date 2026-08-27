"use client";

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import StatusBadge from '@/components/StatusBadge';
import ReturnTimeline from '@/components/ReturnTimeline';

const ShipmentQR = dynamic(() => import('@/components/ShipmentQR'), {
  ssr: false,
  loading: () => <div className="h-[140px] w-[140px] animate-pulse rounded-lg bg-[#F2F4F7]" />,
});
const ShipmentLiveMap = dynamic(() => import('@/components/ShipmentLiveMap'), {
  ssr: false,
  loading: () => <div className="min-h-[320px] w-full animate-pulse rounded-xl bg-[#F2F4F7]" />,
});
import { btnPrimary, btnGhost, inputCls, Field, Modal } from '@/components/ui';
import {
  STATUS_LABELS, STATUS_COLORS, NEXT_STATUS, FAILURE_REASONS,
  formatDateTime, formatNumber,
} from '@/lib/constants';
import { csrfHeaders } from '@/lib/csrf';

type EventItem = { id: string; status: string; notes: string | null; createdAt: string; latitude: number | null; longitude: number | null };
type Driver = { id: string; name: string; employeeId: string; status: string; busy?: boolean };
type Vehicle = { id: string; vehicleNumber: string; status: string; busy?: boolean };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function slaInfo(status: string, deadline: string | null) {
  if (!deadline) return null;
  if (['DELIVERED', 'RETURNED'].includes(status)) return { type: 'DONE' as const, label: 'Selesai (dalam SLA)' };
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining < 0) return { type: 'BREACHED' as const, label: 'SLA Terlambat' };
  if (remaining < 2.4 * 3600000) return { type: 'AT_RISK' as const, label: 'SLA At Risk', remaining };
  return { type: 'ON_TIME' as const, label: 'SLA On Time', remaining };
}

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [shipment, setShipment] = useState<any>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('');
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [statusForm, setStatusForm] = useState({ status: '', notes: '', lat: '', lng: '' });
  const [statusOpen, setStatusOpen] = useState(false);
  const [failReason, setFailReason] = useState(FAILURE_REASONS[0]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ driverId: '', vehicleId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/shipments/${id}`);
    if (!res.ok) {
      setErr('Shipment tidak ditemukan');
      setLoading(false);
      return;
    }
    setShipment(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.user?.role) setRole(d.user.role);
    }).catch(() => {});
  }, []);

  async function postActions(fn: () => Promise<Response>) {
    setBusy(true);
    const res = await fn();
    if (!res.ok) alert((await res.json()).error || 'Gagal');
    else await load();
    setBusy(false);
  }

  async function openAssign() {
    const [dRes, vRes] = await Promise.all([fetch('/api/drivers?pageSize=100'), fetch('/api/vehicles?pageSize=100')]);
    if (dRes.ok) setDrivers(((await dRes.json()).items || []).filter((d: Driver) => d.status === 'ACTIVE' && !d.busy));
    if (vRes.ok) setVehicles(((await vRes.json()).items || []).filter((v: Vehicle) => v.status !== 'MAINTENANCE' && !v.busy));
    const cur = shipment?.assignments?.[0];
    setAssignForm({
      driverId: cur?.driver?.id || '',
      vehicleId: cur?.vehicle?.id || '',
    });
    setAssignOpen(true);
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForm.vehicleId) return alert('Kendaraan wajib dipilih untuk penugasan');
    await postActions(async () =>
      fetch(`/api/shipments/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify(assignForm),
      })
    );
    setAssignOpen(false);
  }

  async function changeStatus(status: string, notes?: string) {
    await postActions(async () =>
      fetch(`/api/shipments/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ status, notes: notes || null }),
      })
    );
  }

  async function markFailed(next: 'RESCHEDULED' | 'RETURN_TO_SENDER') {
    await postActions(async () => {
      const r1 = await fetch(`/api/shipments/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ status: 'DELIVERY_FAILED', notes: failReason }),
      });
      if (!r1.ok) return r1;
      return fetch(`/api/shipments/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ status: next, notes: next === 'RESCHEDULED' ? 'Dijadwalkan ulang' : 'Pengembalian ke pengirim' }),
      });
    });
    setStatusOpen(false);
  }

  async function submitManualStatus(e: React.FormEvent) {
    e.preventDefault();
    await postActions(async () =>
      fetch(`/api/shipments/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({
          status: statusForm.status,
          notes: statusForm.notes || null,
          lat: statusForm.lat ? Number(statusForm.lat) : null,
          lng: statusForm.lng ? Number(statusForm.lng) : null,
        }),
      })
    );
    setStatusOpen(false);
  }

  if (loading) return <div className="py-20 text-center text-[#667085]">Memuat...</div>;
  if (err) return <div className="py-20 text-center text-[#667085]">{err}</div>;

  const s = shipment;
  const next = NEXT_STATUS[s.status];
  const events: EventItem[] = s.events || [];
  const assignment = s.assignments?.[0];
  const hasAssignment = !!assignment?.driver?.id && !!assignment?.vehicle?.id;
  const pod = s.pods?.[0];
  const terminal = ['DELIVERED', 'RETURNED'].includes(s.status);

  return (
    <div className="space-y-5">
      {isSuperAdmin && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          <b>Mode Monitoring</b> — Anda melihat data shipment dari tenant. Perubahan status dilakukan oleh tenant/driver.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-bold text-[#0D6EFD]">{s.trackingNumber}</h1>
            <StatusBadge status={s.status} />
          </div>
          <p className="mt-1 text-sm text-[#667085]">
            Dibuat {formatDateTime(s.createdAt)} · Service {s.serviceType} · {formatNumber(s.weight)} kg · {s.itemName || 'Paket'}
          </p>
        </div>
        <Link href="/shipments" className={btnGhost + ' !py-1.5'}>← Kembali</Link>
      </div>

      {/* SLA & ETA */}
      {(() => {
        const si = slaInfo(s.status, s.slaDeadline);
        if (!si) return null;
        const lastEv = events[events.length - 1];
        const distKm = s.destLat ? haversineKm(lastEv?.latitude ?? s.originLat ?? -6.2088, lastEv?.longitude ?? s.originLng ?? 106.8456, s.destLat, s.destLng) : 0;
        const eta = s.destLat ? new Date(Date.now() + (distKm / 35) * 3600000 + 2 * 15 * 60000) : null;
        const cls = si.type === 'BREACHED' ? 'bg-red-50 border-red-200 text-red-700' : si.type === 'AT_RISK' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
        return (
          <div className={`grid gap-3 rounded-xl border px-4 py-3 text-sm md:grid-cols-3 ${cls}`}>
            <div>
              <div className="text-xs font-bold uppercase opacity-70">SLA</div>
              <div className="font-semibold">{si.label}</div>
              {si.remaining != null && <div className="text-xs opacity-80">{Math.floor(si.remaining / 3600000)} jam {Math.round((si.remaining % 3600000) / 60000)} mnt tersisa</div>}
            </div>
            <div>
              <div className="text-xs font-bold uppercase opacity-70">Deadline SLA</div>
              <div className="font-semibold">{s.slaDeadline ? formatDateTime(s.slaDeadline) : '-'}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase opacity-70">Estimasi Tiba</div>
              <div className="font-semibold">{eta ? formatDateTime(eta) : 'Menunggu koordinat'}</div>
              {distKm > 0 && <div className="text-xs opacity-80">{distKm.toFixed(1)} km dari posisi terakhir</div>}
            </div>
          </div>
        );
      })()}

      {/* Peta lokasi paket: posisi nyata driver saat ini */}
      <ShipmentLiveMap
        trackingNumber={s.trackingNumber}
        origin={s.origin}
        destination={s.destination}
        originLat={s.originLat}
        originLng={s.originLng}
        destLat={s.destLat}
        destLng={s.destLng}
        driver={assignment?.driver || null}
        status={s.status}
      />

      {/* Aksi status — hanya untuk tenant, superadmin hanya memantau */}
      {!terminal && !isSuperAdmin && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-4">
          <span className="text-sm font-bold text-[#101828]">Aksi:</span>
          {next && (() => {
            const dispatchBlocked = next === 'DISPATCHED' && !hasAssignment;
            return (
              <button
                onClick={() => changeStatus(next)}
                disabled={busy || dispatchBlocked}
                className={btnPrimary}
                title={dispatchBlocked ? 'Pilih driver dan kendaraan terlebih dahulu' : undefined}
              >
                Lanjut → {STATUS_LABELS[next]}
              </button>
            );
          })()}
          {next === 'DISPATCHED' && !hasAssignment && (
            <span className="text-xs font-semibold text-[#F5222D]">
              ⚠ Pilih driver &amp; kendaraan dulu untuk keberangkatan
            </span>
          )}
          <button onClick={() => { setStatusForm({ status: s.status, notes: '', lat: '', lng: '' }); setStatusOpen(true); }} disabled={busy} className={btnGhost}>
            Update Status / Lokasi
          </button>
          {s.status === 'OUT_FOR_DELIVERY' && (
            <button onClick={() => { setStatusForm({ status: 'DELIVERY_FAILED', notes: '', lat: '', lng: '' }); setFailReason(FAILURE_REASONS[0]); setStatusOpen(true); }} disabled={busy} className="rounded-lg bg-[#F5222D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D41D25]">
              Gagal Delivery
            </button>
          )}
          {s.status === 'DELIVERY_FAILED' && (
            <>
              <button onClick={() => markFailed('RESCHEDULED')} disabled={busy} className={btnGhost}>Jadwalkan Ulang</button>
              <button onClick={() => markFailed('RETURN_TO_SENDER')} disabled={busy} className="rounded-lg bg-[#F5222D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D41D25]">
                Return ke Pengirim
              </button>
            </>
          )}
        </div>
      )}

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard title="Pengirim">
          <p className="font-semibold text-[#101828]">{s.sender?.name}</p>
          <p className="text-xs text-[#667085]">{s.sender?.phone}</p>
          <p className="text-xs text-[#667085]">{s.sender?.address}, {s.sender?.city || ''}</p>
        </InfoCard>
        <InfoCard title="Penerima">
          <p className="font-semibold text-[#101828]">{s.receiver?.name}</p>
          <p className="text-xs text-[#667085]">{s.receiver?.phone}</p>
          <p className="text-xs text-[#667085]">{s.receiver?.address}, {s.receiver?.city || ''}</p>
        </InfoCard>
        <InfoCard title="Pengiriman">
          <div className="space-y-1 text-xs text-[#667085]">
            <div><b>Asal:</b> {s.origin}</div>
            <div><b>Tujuan:</b> {s.destination}</div>
            {s.distanceKm != null ? (
              <div><b>Estimasi Jarak:</b> {formatNumber(s.distanceKm)} km{s.durationMin != null ? ` · ±${Math.floor(s.durationMin / 60)} jam ${s.durationMin % 60} mnt` : ''}</div>
            ) : (
              <div><b>Service:</b> {s.serviceType}</div>
            )}
            <div><b>Fragile:</b> {s.fragile ? 'Ya' : 'Tidak'}</div>
          </div>
        </InfoCard>
        <InfoCard title="Penugasan">
          {assignment ? (
            <div className="space-y-1 text-xs text-[#667085]">
              <div><b>Driver:</b> {assignment.driver?.name}</div>
              <div><b>Kendaraan:</b> {assignment.vehicle?.vehicleNumber || '-'}</div>
              <div><b>Tugas:</b> {formatDateTime(assignment.assignedAt)}</div>
            </div>
          ) : (
            <p className="text-xs text-[#667085]">Belum ditugaskan</p>
          )}
          {!isSuperAdmin && (
            <button onClick={openAssign} className="mt-2 text-xs font-bold text-[#0D6EFD] hover:underline">
              {assignment ? 'Ganti Assignment' : '+ Tugaskan Driver'}
            </button>
          )}
        </InfoCard>
      </div>

      {/* Daftar perjalanan multi-stop */}
      {s.stops && s.stops.length >= 2 && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 text-sm font-bold text-[#101828]">Daftar Perjalanan ({s.stops.length} titik)</h2>
          <ol className="space-y-0">
            {s.stops.map((st: any, i: number) => (
              <li key={st.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < s.stops.length - 1 && <span className="absolute left-[15px] top-8 h-full w-0.5 bg-[#E4E7EC]" />}
                <span
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${i === 0 ? 'bg-emerald-500' : 'bg-[#F5222D]'}`}
                >
                  {i === 0 ? '🏭' : i}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#101828]">
                    {i === 0 ? 'Pengirim' : `Tujuan ${i}`}: {st.label}
                  </p>
                  <p className="text-xs text-[#667085]">{st.city || '-'}{st.address ? ` · ${st.address}` : ''}</p>
                  {st.latitude != null && st.longitude != null && (
                    <p className="text-[11px] font-mono text-[#667085]">📍 {st.latitude.toFixed(5)}, {st.longitude.toFixed(5)}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Timeline */}
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-bold text-[#101828]">Timeline Perjalanan</h2>
          <div className="space-y-0">
            {events.map((ev, i) => {
              const isLast = i === events.length - 1;
              return (
                <div key={ev.id} className="relative flex gap-3 pb-5">
                  {!isLast && <span className="absolute left-[7px] top-4 h-full w-0.5 bg-[#E4E7EC]" />}
                  <span className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 ${STATUS_COLORS[ev.status]?.includes('bg-emerald') ? 'border-emerald-300 bg-emerald-500' : STATUS_COLORS[ev.status]?.includes('bg-red') ? 'border-red-300 bg-red-500' : 'border-[#0D6EFD]/30 bg-[#0D6EFD]'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#101828]">{STATUS_LABELS[ev.status] || ev.status}</span>
                      <span className="text-[11px] text-[#667085]">{formatDateTime(ev.createdAt)}</span>
                    </div>
                    {ev.notes && <p className="text-xs text-[#667085]">{ev.notes}</p>}
                    {ev.latitude != null && (
                      <p className="text-[11px] font-mono text-[#667085]">📍 {ev.latitude.toFixed(5)}, {ev.longitude?.toFixed(5)}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {events.length === 0 && <p className="text-sm text-[#667085]">Belum ada event</p>}
          </div>
        </div>

        {/* Timeline Perjalanan Kembali */}
        <ReturnTimeline driverId={assignment?.driver?.id} driverName={assignment?.driver?.name} />

        <div className="space-y-5">
          {/* QR resi — hanya untuk tenant */}
          {!isSuperAdmin && (
          <div className="flex items-start gap-4 rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ShipmentQR value={s.trackingNumber} />
            <div>
              <h2 className="text-sm font-bold text-[#101828]">QR Resi</h2>
              <p className="mt-1 text-xs text-[#667085]">
                Pindai untuk proses verifikasi gudang – dispatch. Numerik juga dapat diketik/scanner USB.
              </p>
              <Link href={`/warehouse/scan?resi=${encodeURIComponent(s.trackingNumber)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#0D6EFD] hover:underline">
                Buka Scan Gudang →
              </Link>
            </div>
          </div>
          )}
          {/* POD */}
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-3 text-sm font-bold text-[#101828]">Proof of Delivery</h2>
            {pod ? (
              <div className="space-y-1 text-sm text-[#101828]">
                <p><b>Penerima:</b> {pod.receiverName}</p>
                {pod.notes && <p className="text-xs text-[#667085]"><b>Catatan:</b> {pod.notes}</p>}
                <p className="text-xs text-[#667085]"><b>Waktu terima:</b> {formatDateTime(pod.deliveredAt)}</p>
                {pod.latitude != null && <p className="text-[11px] font-mono text-[#667085]">📍 {pod.latitude.toFixed(5)}, {pod.longitude?.toFixed(5)}</p>}
                {pod.signature && pod.signature.startsWith('data:image') && pod.signature.length > 1000 ? (
                  <div className="mt-2 rounded-lg border border-[#E4E7EC] p-2">
                    <p className="mb-1 text-xs font-semibold text-[#667085]">Tanda tangan digital:</p>
                    <img src={pod.signature} alt="tanda tangan" className="h-24 w-full object-contain bg-white" />
                  </div>
                ) : (
                  <p className="text-xs text-[#667085]">Tanda tangan tersedia (persist via POD driver app)</p>
                )}
                {pod.photo && pod.photo.startsWith('data:image') ? (
                  <img src={pod.photo} alt="bukti foto" className="mt-2 h-32 w-full rounded-lg object-cover bg-[#F7F9FC]" />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[#667085]">Belum ada bukti penerimaan. Selesaikan delivery melalui aplikasi driver.</p>
            )}
          </div>

          {/* Info barang */}
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-3 text-sm font-bold text-[#101828]">Detail Barang</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E7EC] text-left text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
                    <th className="py-1 pr-3">Nama</th>
                    <th className="py-1 pr-3">Qty</th>
                    <th className="py-1 pr-3">Berat</th>
                    <th className="py-1">Dimensi</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.items || []).map((it: any) => (
                    <tr key={it.id} className="border-b border-[#E4E7EC] last:border-0">
                      <td className="py-1.5 pr-3 text-[#101828]">{it.itemName}</td>
                      <td className="py-1.5 pr-3 text-[#667085]">{it.quantity}</td>
                      <td className="py-1.5 pr-3 text-[#667085]">{it.weight ? `${it.weight} kg` : '-'}</td>
                      <td className="py-1.5 text-[#667085]">{it.dimension || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(s.photo1 || s.photo2) && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold text-[#667085]">Foto Barang:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[s.photo1, s.photo2].filter(Boolean).map((p: string, i: number) => (
                    <a key={i} href={p} target="_blank" rel="noreferrer">
                      <img src={p} alt={`Foto barang ${i + 1}`} className="h-28 w-full rounded-lg border border-[#E4E7EC] object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal assignment — hanya untuk tenant */}
      {!isSuperAdmin && (
      <Modal open={assignOpen} title="Tugaskan Driver" onClose={() => setAssignOpen(false)}>
        <form onSubmit={assign} className="space-y-4">
          <Field label="Driver" required>
            <select required value={assignForm.driverId} onChange={(e) => setAssignForm({ ...assignForm, driverId: e.target.value })} className={inputCls}>
              <option value="">-- Pilih driver --</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.employeeId})</option>)}
            </select>
            {drivers.length === 0 && (
              <p className="mt-1 text-xs text-[#FF8A00]">Semua driver aktif sedang dalam perjalanan / belum kembali.</p>
            )}
          </Field>
          <Field label="Kendaraan" required>
            <select required value={assignForm.vehicleId} onChange={(e) => setAssignForm({ ...assignForm, vehicleId: e.target.value })} className={inputCls}>
              <option value="">-- Pilih kendaraan --</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.status})</option>)}
            </select>
            {vehicles.length === 0 && (
              <p className="mt-1 text-xs text-[#FF8A00]">Semua kendaraan sedang dipakai / tidak tersedia.</p>
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAssignOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={busy} className={btnPrimary}>Simpan</button>
          </div>
        </form>
      </Modal>
      )}

      {/* Modal status — hanya untuk tenant */}
      {!isSuperAdmin && (
      <Modal open={statusOpen} title="Update Status & Lokasi" onClose={() => setStatusOpen(false)}>
        {s.status === 'OUT_FOR_DELIVERY'
          ? (
            <div className="space-y-4">
              <Field label="Alasan Gagal" required>
                <select value={failReason} onChange={(e) => setFailReason(e.target.value)} className={inputCls}>
                  {FAILURE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setStatusOpen(false)} className={btnGhost}>Batal</button>
                <button onClick={() => {
                  setStatusOpen(false);
                  changeStatus('DELIVERY_FAILED', failReason);
                }} disabled={busy} className="rounded-lg bg-[#F5222D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D41D25]">Tandai Gagal</button>
              </div>
            </div>
          )
          : (
            <form onSubmit={submitManualStatus} className="space-y-4">
              <Field label="Status Baru" required>
                <select required value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} className={inputCls}>
                  {Object.keys(STATUS_LABELS).map((st) => (
                    <option key={st} value={st}>{STATUS_LABELS[st]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Catatan">
                <textarea value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} className={inputCls} rows={2} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <input value={statusForm.lat} onChange={(e) => setStatusForm({ ...statusForm, lat: e.target.value })} className={inputCls} placeholder="-6.20000" />
                </Field>
                <Field label="Longitude">
                  <input value={statusForm.lng} onChange={(e) => setStatusForm({ ...statusForm, lng: e.target.value })} className={inputCls} placeholder="106.81600" />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setStatusOpen(false)} className={btnGhost}>Batal</button>
                <button type="submit" disabled={busy} className={btnPrimary}>Simpan</button>
              </div>
            </form>
          )}
      </Modal>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#667085]">{title}</div>
      {children}
    </div>
  );
}
