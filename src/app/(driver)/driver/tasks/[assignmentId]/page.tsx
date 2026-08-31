'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import SignaturePad from '@/components/SignaturePad';
import ShipmentQR from '@/components/ShipmentQR';
import { getGPS } from '@/lib/gps';
import { inputCls, btnPrimary, btnGhost } from '@/components/ui';
import { STATUS_LABELS, formatDateTime, formatNumber, FAILURE_REASONS } from '@/lib/constants';
import DriverArrivalConfirm from '@/components/DriverArrivalConfirm';

type Assignment = {
  id: string;
  vehicle: { vehicleNumber: string } | null;
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    origin: string;
    destination: string;
    weight: number;
    createdAt: string;
    durationMin: number | null;
    sender: { name: string; phone: string };
    receiver: { name: string; phone: string; address: string | null; city: string | null };
    events: { id: string; status: string; notes: string | null; createdAt: string }[];
    pods: { receiverName: string; deliveredAt: string; signature: string | null; photo: string | null; notes: string | null }[];
  };
};

const NEXT_STEP: Record<string, { status: string; label: string; hint: string }> = {
  DISPATCHED: { status: 'IN_TRANSIT', label: 'Mulai Pengiriman', hint: 'Tandai saat mulai membawa barang menuju tujuan.' },
  IN_TRANSIT: { status: 'ARRIVED_AT_HUB', label: 'Tiba di Hub', hint: 'Tandai saat tiba di hub tujuan.' },
  ARRIVED_AT_HUB: { status: 'OUT_FOR_DELIVERY', label: 'Mulai Antar', hint: 'Tandai saat mulai mengantar ke penerima.' },
};

export default function TaskPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = use(params);
  const [task, setTask] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [receiverName, setReceiverName] = useState('');
  const [signature, setSignature] = useState('');
  const [photo, setPhoto] = useState('');
  const [notes, setNotes] = useState('');

  const [returning, setReturning] = useState(false);
  const [returnedAt, setReturnedAt] = useState<string | null>(null);
  const [retBusy, setRetBusy] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [arriveOpen, setArriveOpen] = useState(false);
  const [arriveDone, setArriveDone] = useState(false);

  const [showFailure, setShowFailure] = useState(false);
  const [failureStatus, setFailureStatus] = useState('DELIVERY_FAILED');
  const [failureReason, setFailureReason] = useState('');
  const [failureNotes, setFailureNotes] = useState('');
  const [failureBusy, setFailureBusy] = useState(false);

  async function loadDriverStatus() {
    const res = await fetch('/api/driver/status');
    if (res.ok) {
      const d = (await res.json()).driver;
      setReturning(!!d.returning);
      setReturnedAt(d.returnedAt || null);
      setEmployeeId(d.employeeId || '');
    }
  }

  async function toggleReturn(action: 'start' | 'complete') {
    if (retBusy) return;
    if (action === 'complete' && returning) {
      setArriveOpen(true);
      return;
    }
    setRetBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/driver/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal menyimpan status kembali' }));
        setMsg(data.error || 'Gagal menyimpan status kembali');
      } else {
        setMsg(action === 'start' ? 'Berhasil! Perjalanan kembali ke gudang dimulai.' : 'Berhasil! Driver sudah kembali ke gudang.');
        await loadDriverStatus();
      }
    } catch {
      setMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    setRetBusy(false);
  }

  function onArriveDone() {
    setArriveOpen(false);
    setArriveDone(true);
    setReturnedAt(new Date().toISOString());
    loadDriverStatus();
    load();
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/driver/tasks/${assignmentId}`);
      if (!res.ok) {
        setErr('Tugas tidak ditemukan');
        setLoading(false);
        return;
      }
      const data = (await res.json()).assignment;
      setTask(data);
      setReceiverName(data.shipment.receiver.name);
    } catch {
      setErr('Gagal terhubung ke server');
    }
    setLoading(false);
  }, [assignmentId]);
  useEffect(() => { load(); loadDriverStatus(); }, [assignmentId, load]);

  function updateStatus(status: string, statusNotes?: string, lat?: number | null, lng?: number | null) {
    return fetch(`/api/shipments/${task!.shipment.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes: statusNotes || null, lat: lat ?? null, lng: lng ?? null }),
    });
  }

  async function submitPOD(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { lat, lng } = await getGPS();
      const res = await fetch(`/api/shipments/${task!.shipment.id}/pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverName, signature, photo, notes, lat, lng }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal menyimpan POD' }));
        setMsg(data.error || 'Gagal menyimpan POD');
      } else setMsg('Berhasil! Barang ditandai terkirim.');
    } catch {
      setMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    setBusy(false);
    await load();
  }

  async function fileToDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function reportFailure(e: React.FormEvent) {
    e.preventDefault();
    if (failureBusy) return;
    setFailureBusy(true);
    setMsg('');
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await getGPS();
      lat = pos.lat;
      lng = pos.lng;
    } catch {
      // lokasi opsional
    }
    const combined = [failureReason, failureNotes].filter(Boolean).join(' — ') || undefined;
    try {
      const res = await updateStatus(failureStatus, `Driver melapor kendala: ${combined || 'tanpa keterangan'}`, lat, lng);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal mengirim laporan' }));
        setMsg(data.error || 'Gagal mengirim laporan');
      } else {
        setMsg(failureStatus === 'DELIVERY_FAILED' ? 'Berhasil! Pengiriman ditandai gagal. Petugas akan menindaklanjuti.' : 'Berhasil! Pengiriman dijadwalkan ulang.');
        setShowFailure(false);
        setFailureReason('');
        setFailureNotes('');
      }
    } catch {
      setMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    setFailureBusy(false);
    await load();
  }

  if (loading) return <div className="py-20 text-center text-[#667085]">Memuat tugas...</div>;
  if (err) return <div className="py-20 text-center text-[#667085]">{err}</div>;

  const s = task!.shipment;
  const vehicle = task!.vehicle;
  const pod = s.pods[0];
  const events = s.events;
  const step = NEXT_STEP[s.status];
  const backAt = new Date(new Date(s.createdAt).getTime() + (s.durationMin ?? 0) * 60000);

  async function advance() {
    if (!step || busy) return;
    setBusy(true);
    setMsg('');
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await getGPS();
      lat = pos.lat;
      lng = pos.lng;
    } catch {
      // lokasi opsional
    }
    try {
      const res = await updateStatus(step.status, `Cek-in driver: ${step.label}`, lat, lng);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Gagal memperbarui status' }));
        setMsg(error.error || 'Gagal memperbarui status');
      } else {
        setMsg('Status diperbarui');
      }
    } catch {
      setMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/driver" className={btnGhost + ' !py-1.5'}>&larr; Tugas</Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[#0D6EFD]">{s.trackingNumber}</span>
          <StatusBadge status={s.status} />
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('Berhasil') || msg.startsWith('Status') ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-red-50 text-[#F5222D]'}`}>
          {msg}
        </div>
      )}

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase text-[#667085]">Pengirim</div>
            <div className="text-sm font-semibold text-[#101828]">{s.sender.name}</div>
            <div className="text-xs text-[#667085]">{s.sender.phone}</div>
            <div className="mt-2 text-[11px] uppercase text-[#667085]">Asal</div>
            <div className="text-sm text-[#101828]">{s.origin}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-[#667085]">Penerima</div>
            <div className="text-sm font-semibold text-[#101828]">{s.receiver.name}</div>
            <div className="text-xs text-[#667085]">{s.receiver.address}, {s.receiver.city}</div>
            <div className="text-xs text-[#667085]">{s.receiver.phone}</div>
            <div className="mt-2 text-[11px] uppercase text-[#667085]">Tujuan</div>
            <div className="text-sm text-[#101828]">{s.destination}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-[#F7F9FC] pt-3 text-xs text-[#667085]">
          <span>Berat: <b>{formatNumber(s.weight)} kg</b></span>
          <span>Kendaraan: <b>{vehicle?.vehicleNumber || '-'}</b></span>
        </div>
      </div>

      {!pod && ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP'].includes(s.status) && (
        <div className="rounded-2xl border-2 border-[#0D6EFD]/20 bg-gradient-to-br from-[#EFF6FF] to-white p-5 text-center shadow-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D6EFD] text-white font-bold text-xs">QR</div>
          <h3 className="mt-3 text-sm font-bold text-[#101828]">QR Keberangkatan</h3>
          <p className="mx-auto mt-1 max-w-xs text-xs text-[#667085]">Tunjukkan QR sekali saja kepada penjaga gudang. Satu kali scan cukup untuk verifikasi keberangkatan</p>
          <div className="mt-4 flex justify-center">
            <div className="rounded-2xl bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <ShipmentQR value={`DRV:${employeeId}:SHP:${s.id}`} size={180} />
            </div>
          </div>
          <div className="mt-3 font-mono text-sm font-bold tracking-wider text-[#0D6EFD]">{s.trackingNumber}</div>
          <div className="mt-1 text-[11px] text-[#667085]">Driver: {employeeId || '-'} · Scan di menu Warehouse → Scan</div>
        </div>
      )}

      {!pod && ['WAREHOUSE_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB'].includes(s.status) && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          {s.status === 'DISPATCHED' ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#E6F9EF] p-3 text-sm text-[#16B364]">
                ✅ Barang sudah diberangkatkan dari gudang (diverifikasi via scan). Selamat bertugas!
              </div>
              {step && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">{step.label}</p>
                    <p className="text-xs text-[#667085]">{step.hint}</p>
                  </div>
                  <button onClick={advance} disabled={busy} className={btnPrimary}>
                    {busy ? 'Menyimpan...' : step.label}
                  </button>
                </div>
              )}
            </div>
          ) : step ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#101828]">{step.label}</p>
                <p className="text-xs text-[#667085]">{step.hint}</p>
              </div>
              <button onClick={advance} disabled={busy} className={btnPrimary}>
                {busy ? 'Menyimpan...' : step.label}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#667085]">
              Barang menunggu verifikasi keberangkatan oleh gudang. Tunjukkan QR di atas — cukup satu kali scan.
            </p>
          )}
        </div>
      )}

      {!pod && s.status === 'OUT_FOR_DELIVERY' && (
        <form onSubmit={submitPOD} className="space-y-4 rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="text-sm font-bold text-[#101828]">Proof of Delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">Nama Penerima *</label>
                <input required value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">Catatan Driver</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={3} placeholder="Kondisi barang, dst" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">Foto Barang / Penerima</label>
                <input
                  type="file" accept="image/*" capture="environment"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setPhoto(await fileToDataURL(f));
                  }}
                  className={inputCls}
                />
                {photo && <img src={photo} alt="bukti" className="mt-2 h-24 rounded-lg object-cover" />}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Tanda Tangan Penerima *</label>
              <SignaturePad onChange={setSignature} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Menyimpan...' : 'Selesaikan Delivery'}
            </button>
          </div>
        </form>
      )}

      {!pod && ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY'].includes(s.status) && (
        <div className="rounded-xl border border-[#F3D1D4] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {!showFailure ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#F5222D]">Ada kendala pengiriman?</p>
                <p className="text-xs text-[#667085]">Laporkan gagal atau minta jadwal ulang. Petugas operasional akan menindaklanjuti.</p>
              </div>
              <button onClick={() => setShowFailure(true)} className="rounded-lg border border-[#F5222D] bg-white px-4 py-2 text-sm font-semibold text-[#F5222D] hover:bg-red-50">
                Laporkan Kendala
              </button>
            </div>
          ) : (
            <form onSubmit={reportFailure} className="space-y-3">
              <h3 className="text-sm font-bold text-[#101828]">Laporan Kendala Pengiriman</h3>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">Jenis Laporan</label>
                <select value={failureStatus} onChange={(e) => setFailureStatus(e.target.value)} className={inputCls}>
                  <option value="DELIVERY_FAILED">Gagal Dikirim</option>
                  <option value="RESCHEDULED">Tunda / Jadwal Ulang</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">Alasan</label>
                <select value={failureReason} onChange={(e) => setFailureReason(e.target.value)} className={inputCls}>
                  <option value="">Pilih alasan...</option>
                  {FAILURE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#667085]">Catatan (opsional)</label>
                <textarea value={failureNotes} onChange={(e) => setFailureNotes(e.target.value)} className={inputCls} rows={2} placeholder="Penjelasan tambahan, situasi di lapangan, dst" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={failureBusy} className={btnPrimary + ' flex-1'}>
                  {failureBusy ? 'Mengirim...' : 'Kirim Laporan'}
                </button>
                <button type="button" onClick={() => setShowFailure(false)} className={btnGhost}>
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {pod && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-emerald-700">Laporan Pengiriman</h2>
            <span className="rounded-full bg-[#E6F9EF] px-2 py-0.5 text-[11px] font-semibold text-[#16B364]">Delivery Selesai</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-[#F7F9FC] pb-1.5">
                <span className="text-[#667085]">Resi</span>
                <span className="font-mono font-semibold text-[#101828]">{s.trackingNumber}</span>
              </div>
              <div className="flex justify-between border-b border-[#F7F9FC] pb-1.5">
                <span className="text-[#667085]">Penerima</span>
                <span className="font-semibold text-[#101828]">{pod.receiverName}</span>
              </div>
              <div className="flex justify-between border-b border-[#F7F9FC] pb-1.5">
                <span className="text-[#667085]">Waktu Terima</span>
                <span className="font-semibold text-[#101828]">{formatDateTime(pod.deliveredAt)}</span>
              </div>
              <div className="flex justify-between border-b border-[#F7F9FC] pb-1.5">
                <span className="text-[#667085]">Lokasi Terima</span>
                <span className="font-semibold text-[#101828]">{s.destination}</span>
              </div>
              <div className="flex justify-between border-b border-[#F7F9FC] pb-1.5">
                <span className="text-[#667085]">Catatan Driver</span>
                <span className="max-w-[55%] text-right font-semibold text-[#101828]">{pod.notes || '-'}</span>
              </div>
            </div>
            <div className="space-y-3">
              {pod.signature && pod.signature.startsWith('data:image') && pod.signature.length > 1000 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase text-[#667085]">Tanda Tangan Penerima</div>
                  <img src={pod.signature} alt="tanda tangan" className="h-20 rounded-lg border border-[#E4E7EC] bg-white" />
                </div>
              )}
              {pod.photo && (
                <div>
                  <div className="mb-1 text-[11px] uppercase text-[#667085]">Foto Bukti</div>
                  <img src={pod.photo} alt="bukti" className="h-20 rounded-lg border border-[#E4E7EC] bg-white object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {returning ? 'Dalam perjalanan kembali ke gudang asal' : returnedAt ? 'Tugas selesai' : 'Pengiriman selesai'}
                </p>
                <p className="text-xs text-amber-600">
                  {returning
                    ? 'Aktifkan GPS supaya rute kembali tampil kuning di peta admin, lalu tandai saat tiba.'
                    : returnedAt
                      ? `Anda telah tiba di gudang asal pada ${formatDateTime(backAt)}.`
                      : 'Tandai untuk mulai perjalanan kembali ke gudang asal (rute kembali tampil kuning di peta admin).'}
                </p>
              </div>
              {returning ? (
                <button
                  onClick={() => setArriveOpen(true)}
                  disabled={retBusy}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {retBusy ? 'Menyimpan...' : 'Tiba di Gudang - Selesai'}
                </button>
              ) : !returnedAt ? (
                <button
                  onClick={() => toggleReturn('start')}
                  disabled={retBusy}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {retBusy ? 'Menyimpan...' : 'Kembali ke Gudang Asal'}
                </button>
              ) : null}
            </div>
          </div>
          {arriveOpen && !arriveDone && (
            <div className="mt-3">
              <DriverArrivalConfirm onDone={onArriveDone} />
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-4 text-sm font-bold text-[#101828]">Timeline</h2>
        <div>
          {events.map((ev, i) => (
            <div key={ev.id} className="relative flex gap-3 pb-5">
              {i !== events.length - 1 && <span className="absolute left-[7px] top-4 h-full w-0.5 bg-[#E4E7EC]" />}
              <span className="relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-[#B3D4FF] bg-[#0D6EFD]" />
              <div>
                <div className="text-sm font-semibold text-[#101828]">{STATUS_LABELS[ev.status] || ev.status}</div>
                <div className="text-[11px] text-[#667085]">{formatDateTime(ev.createdAt)}</div>
                {ev.notes && <div className="text-xs text-[#667085]">{ev.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
