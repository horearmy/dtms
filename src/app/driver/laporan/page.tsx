"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import SignaturePad from '@/components/SignaturePad';
import { getGPS } from '@/lib/gps';
import { inputCls, btnPrimary, btnGhost } from '@/components/ui';
import { STATUS_LABELS, formatDateTime, formatNumber } from '@/lib/constants';

type Task = {
  id: string;
  vehicle: { vehicleNumber: string } | null;
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    destination: string;
    weight: number;
    receiver: { name: string; phone: string; address: string | null; city: string | null };
    pods: { receiverName: string; deliveredAt: string; notes: string | null }[];
  };
};

const ARRIVAL_STEP: Record<string, { status: string; label: string; hint: string }> = {
  IN_TRANSIT: { status: 'ARRIVED_AT_HUB', label: 'Lapor Tiba di Hub', hint: 'Kirim laporan saat tiba di hub tujuan.' },
  ARRIVED_AT_HUB: { status: 'OUT_FOR_DELIVERY', label: 'Lapor Mulai Antar', hint: 'Kirim laporan saat mulai mengantar ke penerima.' },
};

function TaskLaporCard({ task, onDone }: { task: Task; onDone: () => void }) {
  const s = task.shipment;
  const pod = s.pods[0];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [arrivalNote, setArrivalNote] = useState('');
  const [receiverName, setReceiverName] = useState(s.receiver.name);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState('');
  const [signature, setSignature] = useState('');

  async function fileToDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function submitArrival() {
    if (busy) return;
    const step = ARRIVAL_STEP[s.status];
    setBusy(true);
    setMsg('');
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await getGPS();
      lat = pos.lat;
      lng = pos.lng;
    } catch {}
    const res = await fetch(`/api/shipments/${s.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: step.status,
        notes: `Laporan kedatangan: ${arrivalNote.trim() || step.label}`,
        lat,
        lng,
      }),
    });
    if (!res.ok) setMsg((await res.json()).error || 'Gagal mengirim laporan');
    else {
      setMsg('Laporan kedatangan terkirim ✓');
      setArrivalNote('');
      setTimeout(onDone, 600);
    }
    setBusy(false);
  }

  async function submitPOD(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    const { lat, lng } = await getGPS();
    const res = await fetch(`/api/shipments/${s.id}/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverName, signature, photo, notes, lat, lng }),
    });
    if (!res.ok) setMsg((await res.json()).error || 'Gagal menyimpan laporan');
    else {
      setMsg('Berhasil! Laporan delivery terkirim.');
      setTimeout(onDone, 600);
    }
    setBusy(false);
  }

  const step = ARRIVAL_STEP[s.status];
  const alreadyDone = pod || s.status === 'DELIVERED' || s.status === 'RETURNED';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/driver/tasks/${task.id}`} className="font-mono text-sm font-bold text-brand-600 hover:underline">
              {s.trackingNumber}
            </Link>
            <StatusBadge status={s.status} />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Penerima: <b>{s.receiver.name}</b> · {s.receiver.address}, {s.receiver.city}
          </div>
          <div className="text-xs text-slate-500">
            Tujuan: {s.destination} · Berat: {formatNumber(s.weight)} kg
            {task.vehicle ? ` · ${task.vehicle.vehicleNumber}` : ''}
          </div>
        </div>
        {pod && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Laporan terkirim ✓</span>}
      </div>

      {msg && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.startsWith('Berhasil') || msg.endsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {msg}
        </div>
      )}

      {!alreadyDone && s.status === 'DISPATCHED' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-600">Barang sudah berangkat dari gudang. Mulai pengiriman untuk mencatat laporan.</p>
          <Link href={`/driver/tasks/${task.id}`} className={btnPrimary}>Mulai Pengiriman</Link>
        </div>
      )}

      {!alreadyDone && step && (
        <div className="mt-3 space-y-3 rounded-lg bg-amber-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-amber-700">{step.label} — Catatan Laporan (opsional)</label>
            <textarea
              value={arrivalNote}
              onChange={(e) => setArrivalNote(e.target.value)}
              className={inputCls}
              rows={2}
              placeholder={`Contoh: tiba ${s.status === 'IN_TRANSIT' ? 'di hub tujuan' : 'di area pengantaran'} pukul ...`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-amber-700">{step.hint}</p>
            <button onClick={submitArrival} disabled={busy} className={btnPrimary}>
              {busy ? 'Mengirim...' : step.label}
            </button>
          </div>
        </div>
      )}

      {!pod && s.status === 'OUT_FOR_DELIVERY' && (
        <form onSubmit={submitPOD} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">Laporan Delivery (sudah sampai di lokasi penerima)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nama Penerima *</label>
                <input required value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Catatan Laporan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} placeholder="Kondisi barang, dst" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Foto Bukti</label>
                <input
                  type="file" accept="image/*" capture="environment"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setPhoto(await fileToDataURL(f));
                  }}
                  className={inputCls}
                />
                {photo && <img src={photo} alt="bukti" className="mt-2 h-20 rounded-lg object-cover" />}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tanda Tangan Penerima *</label>
              <SignaturePad onChange={setSignature} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Menyimpan...' : 'Kirim Laporan Delivery & POD'}
            </button>
          </div>
        </form>
      )}

      {alreadyDone && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3">
          <p className="text-sm text-emerald-700">
            {pod
              ? `Selesai: diterima ${pod.receiverName} · ${formatDateTime(pod.deliveredAt)}`
              : 'Pengiriman selesai.'}
          </p>
          <Link href={`/driver/tasks/${task.id}`} className={btnGhost + ' !py-1.5'}>Lihat Laporan Resi</Link>
        </div>
      )}
    </div>
  );
}

export default function DriverLaporanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [returning, setReturning] = useState(false);
  const [returnedAt, setReturnedAt] = useState<string | null>(null);
  const [retBusy, setRetBusy] = useState(false);
  const [retMsg, setRetMsg] = useState('');
  const [gpsChecking, setGpsChecking] = useState(false);
  const [gpsResult, setGpsResult] = useState<{ on: boolean; lat: number; lng: number; ts: string } | null>(null);

  async function load() {
    const res = await fetch('/api/driver/tasks');
    if (res.ok) setTasks((await res.json()).assignments || []);
  }
  async function loadStatus() {
    const res = await fetch('/api/driver/status');
    if (res.ok) {
      const d = (await res.json()).driver;
      setReturning(!!d.returning);
      setReturnedAt(d.returnedAt || null);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    loadStatus();
  }, []);

  async function toggleReturn(action: 'start' | 'complete') {
    if (retBusy) return;
    setRetBusy(true);
    setRetMsg('');
    const res = await fetch('/api/driver/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) setRetMsg((await res.json()).error || 'Gagal menyimpan laporan kembali');
    else {
      setRetMsg(action === 'start' ? 'Berhasil! Laporan kembali ke gudang terkirim ✓' : 'Berhasil! Driver sudah kembali ke gudang.');
      await loadStatus();
    }
    setRetBusy(false);
  }

  async function checkGps() {
    if (gpsChecking) return;
    setGpsChecking(true);
    setGpsResult(null);
    const ts = new Date().toLocaleTimeString('id-ID');
    const pos = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
      );
    });
    setGpsResult({ on: !!pos, lat: pos?.lat || 0, lng: pos?.lng || 0, ts });
    setGpsChecking(false);
  }

  const active = tasks.filter((t) => ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY'].includes(t.shipment.status));
  const delivered = tasks.filter((t) => t.shipment.status === 'DELIVERED');

  if (loading) return <div className="py-20 text-center text-slate-400">Memuat laporan...</div>;
  if (err) return <div className="py-20 text-center text-slate-500">{err}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Laporan Driver</h1>
        <p className="text-sm text-slate-500">Laporan kedatangan di lokasi & laporan kembali ke gudang</p>
      </div>

      {/* Laporan kedatangan */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-900">📍 Laporan Kedatangan di Lokasi ({active.length})</h2>
        <div className="space-y-3">
          {active.map((t) => <TaskLaporCard key={t.id} task={t} onDone={load} />)}
          {active.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              Tidak ada pengiriman aktif saat ini
            </div>
          )}
        </div>
      </div>

      {/* Laporan kembali ke gudang */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">🚚 Laporan Kembali ke Gudang</h2>
        <p className="text-xs text-slate-500">
          Setelah semua pengiriman selesai, kirim laporan untuk kembali ke gudang asal. Rute kembali akan tampil kuning di peta admin.
        </p>

        {retMsg && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${retMsg.startsWith('Berhasil') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {retMsg}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {returning ? 'Dalam perjalanan kembali ke gudang asal' : 'Siap melapor kembali ke gudang'}
            </p>
            <p className="text-xs text-amber-600">
              {returning
                ? 'Aktifkan GPS agar rute kembali tampil kuning, lalu tandai saat tiba di gudang.'
                : delivered.length > 0
                  ? `${delivered.length} resi selesai. Kirim laporan kembali ke gudang asal.`
                  : 'Belum ada pengiriman selesai. Laporan kembali tersedia setelah delivery selesai.'}
              {!returning && returnedAt && ` · Kembali terakhir: ${formatDateTime(returnedAt)}`}
            </p>
          </div>
          {returning ? (
            <button onClick={() => toggleReturn('complete')} disabled={retBusy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
              {retBusy ? 'Menyimpan...' : '📍 Tiba di Gudang — Selesai'}
            </button>
          ) : (
            <button onClick={() => toggleReturn('start')} disabled={retBusy || delivered.length === 0} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
              {retBusy ? 'Menyimpan...' : '🚚 Kirim Laporan Kembali ke Gudang'}
            </button>
          )}
        </div>

        {delivered.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-4">Resi</th>
                  <th className="py-2 pr-4">Penerima</th>
                  <th className="py-2 pr-4">Waktu Terima</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {delivered.map((t) => {
                  const pod = t.shipment.pods[0];
                  return (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-mono text-xs font-semibold text-brand-600">{t.shipment.trackingNumber}</td>
                      <td className="py-2 pr-4 text-slate-700">{pod?.receiverName || t.shipment.receiver.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{pod ? formatDateTime(pod.deliveredAt) : '-'}</td>
                      <td className="py-2"><StatusBadge status={t.shipment.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cek status GPS */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Status GPS Perangkat</p>
            <p className="text-xs text-slate-500">
              Periksa kembali status lokasi perangkat agar posisi & rute kembali tetap terkirim ke admin.
            </p>
            {gpsResult && (
              <div className={`mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${gpsResult.on ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: gpsResult.on ? '#16a34a' : '#dc2626' }} />
                {gpsResult.on
                  ? `GPS Aktif · ${gpsResult.lat.toFixed(5)}, ${gpsResult.lng.toFixed(5)} · ${gpsResult.ts}`
                  : `GPS Mati / Tidak Aktif · ${gpsResult.ts}`}
              </div>
            )}
          </div>
          <button onClick={checkGps} disabled={gpsChecking} className={btnGhost + ' shrink-0 disabled:opacity-50'}>
            {gpsChecking ? 'Memeriksa...' : '🛰️ Cek Status GPS'}
          </button>
        </div>
      </div>
    </div>
  );
}
