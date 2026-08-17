"use client";

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import SignaturePad from '@/components/SignaturePad';
import { getGPS } from '@/lib/gps';
import { inputCls, btnPrimary, btnGhost } from '@/components/ui';
import { STATUS_LABELS, formatDateTime, formatNumber } from '@/lib/constants';

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
    sender: { name: string; phone: string };
    receiver: { name: string; phone: string; address: string | null; city: string | null };
    events: { id: string; status: string; notes: string | null; createdAt: string }[];
    pods: { receiverName: string; deliveredAt: string; signature: string | null; photo: string | null; notes: string | null }[];
  };
};

const NEXT_STEP: Record<string, { status: string; label: string; hint: string }> = {
  DISPATCHED: { status: 'IN_TRANSIT', label: 'Mulai Pengiriman', hint: 'Tandai setelah barang diberangkatkan dari gudang.' },
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

  async function loadDriverStatus() {
    const res = await fetch('/api/driver/status');
    if (res.ok) {
      const d = (await res.json()).driver;
      setReturning(!!d.returning);
      setReturnedAt(d.returnedAt || null);
    }
  }

  async function toggleReturn(action: 'start' | 'complete') {
    if (retBusy) return;
    setRetBusy(true);
    setMsg('');
    const res = await fetch('/api/driver/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) setMsg((await res.json()).error || 'Gagal menyimpan status kembali');
    else {
      setMsg(action === 'start' ? 'Berhasil! Perjalanan kembali ke gudang dimulai ✓' : 'Berhasil! Driver sudah kembali ke gudang.');
      await loadDriverStatus();
    }
    setRetBusy(false);
  }

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/driver/tasks/${assignmentId}`);
    if (!res.ok) {
      setErr('Tugas tidak ditemukan');
      setLoading(false);
      return;
    }
    const data = (await res.json()).assignment;
    setTask(data);
    setReceiverName(data.shipment.receiver.name);
    setLoading(false);
  }
  useEffect(() => { load(); loadDriverStatus(); }, [assignmentId]);

  function updateStatus(status: string, notes?: string, lat?: number | null, lng?: number | null) {
    return fetch(`/api/shipments/${task!.shipment.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes: notes || null, lat: lat ?? null, lng: lng ?? null }),
    });
  }

  async function submitPOD(e: React.FormEvent) {
    e.preventDefault();
    const { lat, lng } = await getGPS();
    setBusy(true);
    const res = await fetch(`/api/shipments/${task!.shipment.id}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverName, signature, photo, notes, lat, lng }),
    });
    if (!res.ok) setMsg((await res.json()).error || 'Gagal menyimpan POD');
    else setMsg('Berhasil! Barang ditandai terkirim.');
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

  if (loading) return <div className="py-20 text-center text-[#667085]">Memuat tugas...</div>;
  if (err) return <div className="py-20 text-center text-[#667085]">{err}</div>;

  const s = task!.shipment;
  const vehicle = task!.vehicle;
  const pod = s.pods[0];
  const events = s.events;
  const step = NEXT_STEP[s.status];

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
    const res = await updateStatus(step.status, `Cek-in driver: ${step.label}`, lat, lng);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal memperbarui status' }));
      setMsg(err.error || 'Gagal memperbarui status');
    } else {
      setMsg('Status diperbarui ✓');
    }
    setBusy(false);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/driver" className={btnGhost + ' !py-1.5'}>← Tugas</Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[#0D6EFD]">{s.trackingNumber}</span>
          <StatusBadge status={s.status} />
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('Berhasil') ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-red-50 text-[#F5222D]'}`}>
          {msg}
        </div>
      )}

      {/* Ringkasan */}
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
          <span>Jenis Layanan: <b>{s.origin} → {s.destination}</b></span>
        </div>
      </div>

      {/* Aksi */}
      {!pod && ['WAREHOUSE_RECEIVED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB'].includes(s.status) && (
        <div className="rounded-xl border border-[#E4E7EC] bg-white p-4">
          {step ? (
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
              Barang menunggu keberangkatan dari gudang. Gunakan <b>📡 Kirim Lokasi</b> di atas untuk cek-in posisi.
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

      {/* Laporan Pengiriman (setelah POD) */}
      {pod && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-emerald-700">Laporan Pengiriman</h2>
            <span className="rounded-full bg-[#E6F9EF] px-2 py-0.5 text-[11px] font-semibold text-[#16B364]">✓ Delivery Selesai</span>
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

          {/* Kembali ke Gudang Asal (muncul otomatis setelah delivery selesai) */}
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {returning ? 'Dalam perjalanan kembali ke gudang asal' : 'Pengiriman selesai'}
                </p>
                <p className="text-xs text-amber-600">
                  {returning
                    ? 'Aktifkan GPS supaya rute kembali tampil kuning di peta admin, lalu tandai saat tiba.'
                    : 'Tandai untuk mulai perjalanan kembali ke gudang asal (rute kembali tampil kuning di peta admin).'}
                  {!returning && returnedAt && ` · Kembali terakhir: ${formatDateTime(returnedAt)}`}
                </p>
              </div>
              {returning ? (
                <button
                  onClick={() => toggleReturn('complete')}
                  disabled={retBusy}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {retBusy ? 'Menyimpan...' : '📍 Tiba di Gudang — Selesai'}
                </button>
              ) : (
                <button
                  onClick={() => toggleReturn('start')}
                  disabled={retBusy}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {retBusy ? 'Menyimpan...' : '🚚 Kembali ke Gudang Asal'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
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