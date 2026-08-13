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
    pods: { receiverName: string; deliveredAt: string; signature: string | null; notes: string | null }[];
  };
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
  useEffect(() => { load(); }, [assignmentId]);

  function updateStatus(status: string, notes?: string) {
    return fetch(`/api/shipments/${task!.shipment.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes: notes || null }),
    });
  }

  async function withGPSAnd(fn: (lat: number, lng: number) => Promise<Response>) {
    const { lat, lng } = await getGPS();
    setBusy(true);
    const res = await fn(lat, lng);
    if (!res.ok) setMsg((await res.json()).error || 'Gagal');
    else setMsg('');
    setBusy(false);
    await load();
  }

  async function confirmPickup() {
    await withGPSAnd((lat, lng) =>
      fetch(`/api/shipments/${task!.shipment.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PICKED_UP', lat, lng, notes: 'Barang diambil kurir' }),
      })
    );
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

  if (loading) return <div className="py-20 text-center text-slate-400">Memuat tugas...</div>;
  if (err) return <div className="py-20 text-center text-slate-500">{err}</div>;

  const s = task!.shipment;
  const vehicle = task!.vehicle;
  const pod = s.pods[0];
  const events = s.events;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/driver" className={btnGhost + ' !py-1.5'}>← Tugas</Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-brand-700">{s.trackingNumber}</span>
          <StatusBadge status={s.status} />
        </div>
      </div>

      {msg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('Berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {msg}
        </div>
      )}

      {/* Ringkasan */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase text-slate-400">Pengirim</div>
            <div className="text-sm font-semibold text-slate-800">{s.sender.name}</div>
            <div className="text-xs text-slate-500">{s.sender.phone}</div>
            <div className="mt-2 text-[11px] uppercase text-slate-400">Asal</div>
            <div className="text-sm text-slate-700">{s.origin}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-400">Penerima</div>
            <div className="text-sm font-semibold text-slate-800">{s.receiver.name}</div>
            <div className="text-xs text-slate-500">{s.receiver.address}, {s.receiver.city}</div>
            <div className="text-xs text-slate-500">{s.receiver.phone}</div>
            <div className="mt-2 text-[11px] uppercase text-slate-400">Tujuan</div>
            <div className="text-sm text-slate-700">{s.destination}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Berat: <b>{formatNumber(s.weight)} kg</b></span>
          <span>Kendaraan: <b>{vehicle?.vehicleNumber || '-'}</b></span>
          <span>Jenis Layanan: <b>{s.origin} → {s.destination}</b></span>
        </div>
      </div>

      {/* Aksi */}
      {!pod && ['ORDER_CREATED', 'PICKUP_SCHEDULED'].includes(s.status) && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <button onClick={confirmPickup} disabled={busy} className={btnPrimary + ' w-full sm:w-auto'}>
            {busy ? 'Memproses...' : '✓ Konfirmasi Pickup (Barang Diambil)'}
          </button>
          <p className="mt-2 text-xs text-brand-700">Lokasi GPS akan otomatis tercatat pada event.</p>
        </div>
      )}

      {!pod && ['PICKED_UP', 'WAREHOUSE_RECEIVED', 'SORTING', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB'].includes(s.status) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            Barang dalam perjalanan. Cek-in lokasi secara berkala dengan tombol <b>📡 Kirim Lokasi</b> di atas.
          </p>
        </div>
      )}

      {!pod && s.status === 'OUT_FOR_DELIVERY' && (
        <form onSubmit={submitPOD} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Proof of Delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nama Penerima *</label>
                <input required value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Catatan Driver</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={3} placeholder="Kondisi barang, dst" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Foto Barang / Penerima</label>
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tanda Tangan Penerima *</label>
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

      {/* Sudah selesai */}
      {pod && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-lg font-bold text-emerald-700">✓ Delivery Selesai</div>
          <div className="mt-1 text-sm text-emerald-600">
            Diterima oleh <b>{pod.receiverName}</b> · {formatDateTime(pod.deliveredAt)}
          </div>
          {pod.signature && pod.signature.startsWith('data:image') && pod.signature.length > 1000 && (
            <img src={pod.signature} alt="tanda tangan" className="mx-auto mt-3 h-24 bg-white rounded-lg" />
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Timeline</h2>
        <div>
          {events.map((ev, i) => (
            <div key={ev.id} className="relative flex gap-3 pb-5">
              {i !== events.length - 1 && <span className="absolute left-[7px] top-4 h-full w-0.5 bg-slate-200" />}
              <span className="relative mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-brand-300 bg-brand-500" />
              <div>
                <div className="text-sm font-semibold text-slate-800">{STATUS_LABELS[ev.status] || ev.status}</div>
                <div className="text-[11px] text-slate-400">{formatDateTime(ev.createdAt)}</div>
                {ev.notes && <div className="text-xs text-slate-500">{ev.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}