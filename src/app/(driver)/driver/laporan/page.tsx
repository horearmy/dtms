'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { getGPS } from '@/lib/gps';
import { btnGhost } from '@/components/ui';
import { formatDateTime, formatNumber } from '@/lib/constants';

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

const PRE_SCAN = ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP'];

const ADVANCE_STEP: Record<string, string> = {
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED_AT_HUB',
  ARRIVED_AT_HUB: 'OUT_FOR_DELIVERY',
};

type Action = {
  label: string;
  tone: 'red' | 'green' | 'amber' | 'blue' | 'gray';
  kind: 'advance' | 'pod' | 'detail' | 'blocked';
};

const TONES: Record<Action['tone'], string> = {
  red: 'bg-[#F5222D] text-white hover:bg-[#D41D25]',
  green: 'bg-[#16A34A] text-white hover:bg-[#12873B]',
  amber: 'bg-amber-500 text-white hover:bg-amber-600',
  blue: 'bg-[#0D6EFD] text-white hover:bg-[#0B5ED7]',
  gray: 'bg-[#EAECF0] text-[#344054] hover:bg-[#D0D5DD]',
};

function actionFor(status: string, hasPod: boolean): Action {
  if (hasPod || status === 'DELIVERED' || status === 'RETURNED') {
    return { label: 'Selesai', tone: 'green', kind: 'detail' };
  }
  switch (status) {
    case 'WAREHOUSE_RECEIVED':
    case 'SORTING':
    case 'PICKED_UP':
      return { label: 'Mulai', tone: 'red', kind: 'blocked' };
    case 'DISPATCHED':
      return { label: 'Mulai', tone: 'green', kind: 'advance' };
    case 'IN_TRANSIT':
      return { label: 'Lapor Tiba di Hub', tone: 'amber', kind: 'advance' };
    case 'ARRIVED_AT_HUB':
      return { label: 'Mulai Antar', tone: 'blue', kind: 'advance' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Selesai', tone: 'green', kind: 'pod' };
    default:
      return { label: 'Lihat Detail', tone: 'gray', kind: 'detail' };
  }
}

function TaskRow({
  task,
  isDelivered,
  returning,
  returnedAt,
  retBusy,
  onAdvance,
  onReturn,
}: {
  task: Task;
  isDelivered: boolean;
  returning: boolean;
  returnedAt: string | null;
  retBusy: boolean;
  onAdvance: (task: Task) => void;
  onReturn: (action: 'start' | 'complete' | '__scan_hint') => void;
}) {
  const s = task.shipment;
  const pod = s.pods[0];
  const preScan = PRE_SCAN.includes(s.status);
  const action = actionFor(s.status, !!pod);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
        isDelivered ? 'border-[#D3F0E0] bg-[#F6FEF9]' : preScan ? 'border-[#F3D1D4] bg-white' : 'border-[#E4E7EC] bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/driver/tasks/${task.id}`} className="font-mono text-sm font-bold text-[#0D6EFD] hover:underline">
            {s.trackingNumber}
          </Link>
          <StatusBadge status={s.status} />
        </div>
        <div className="mt-1 text-xs text-[#667085]">
          Penerima: <b>{s.receiver.name}</b> · {s.receiver.address}, {s.receiver.city}
        </div>
        <div className="text-xs text-[#667085]">
          Tujuan: {s.destination} · Berat: {formatNumber(s.weight)} kg{task.vehicle ? ` · ${task.vehicle.vehicleNumber}` : ''}
        </div>
        {preScan && (
          <div className="mt-1 text-[11px] font-semibold text-[#F5222D]">Cukup 1x scan gudang untuk berangkat</div>
        )}
        {isDelivered && pod && (
          <div className="mt-1 text-[11px] font-semibold text-[#16A34A]">
            Diterima {pod.receiverName} · {formatDateTime(pod.deliveredAt)}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => {
            if (action.kind === 'blocked') {
              onReturn('__scan_hint');
              return;
            }
            if (action.kind === 'advance') return onAdvance(task);
            window.location.href = `/driver/tasks/${task.id}`;
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${TONES[action.tone]}`}
        >
          {action.kind === 'blocked' ? 'Mulai' : action.label}
        </button>

        {isDelivered && (
          <button
            onClick={() => {
              if (returning) return onReturn('complete');
              if (!returnedAt) return onReturn('start');
            }}
            disabled={retBusy || !!returnedAt}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed ${
              returnedAt ? 'bg-[#EAECF0] text-[#667085]' : returning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {returning ? 'Tiba di Gudang - Selesai' : returnedAt ? 'Sudah kembali' : 'Kembali ke Gudang'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DriverLaporanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

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
    const id = setInterval(() => {
      load();
      loadStatus();
    }, 20000);
    return () => clearInterval(id);
  }, []);

  async function handleAdvance(task: Task) {
    const s = task.shipment;
    const target = ADVANCE_STEP[s.status];
    if (!target) return;
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
      body: JSON.stringify({ status: target, notes: `Laporan laporan: ${s.status} -> ${target}`, lat, lng }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Gagal mengirim laporan' }));
      setNotice(data.error || 'Gagal mengirim laporan');
    } else {
      setNotice('Laporan terkirim');
      await load();
    }
  }

  async function handleReturn(action: 'start' | 'complete' | '__scan_hint') {
    if (action === '__scan_hint') {
      setNotice('Satu kali scan gudang cukup untuk verifikasi keberangkatan. Tunjukkan QR ke penjaga gudang.');
      return;
    }
    if (retBusy) return;
    setRetBusy(true);
    setRetMsg('');
    try {
      const res = await fetch('/api/driver/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal menyimpan laporan kembali' }));
        setRetMsg(data.error || 'Gagal menyimpan laporan kembali');
      } else {
        setRetMsg(action === 'start' ? 'Berhasil! Laporan kembali ke gudang terkirim.' : 'Berhasil! Driver sudah kembali ke gudang.');
        await loadStatus();
      }
    } catch {
      setRetMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
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

  const active = tasks.filter((t) => ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY'].includes(t.shipment.status));
  const delivered = tasks.filter((t) => t.shipment.status === 'DELIVERED');

  if (loading) return <div className="py-20 text-center text-[#667085]">Memuat laporan...</div>;
  if (err) return <div className="py-20 text-center text-[#667085]">{err}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#101828]">Laporan Driver</h1>
        <p className="text-sm text-[#667085]">Tekan tombol berwarna untuk mengirim laporan per pengiriman.</p>
      </div>

      {(notice || retMsg) && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            (notice.startsWith('Berhasil') || notice === 'Laporan terkirim' || (retMsg || '').startsWith('Berhasil'))
              ? 'bg-[#E6F9EF] text-[#16B364]'
              : 'bg-red-50 text-[#F5222D]'
          }`}
        >
          {notice || retMsg}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-bold text-[#101828]">Pengiriman ({active.length + delivered.length})</h2>
        <div className="space-y-3">
          {[...active, ...delivered].length === 0 && (
            <div className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-8 text-center text-sm text-[#667085]">
              Tidak ada pengiriman saat ini
            </div>
          )}
          {active.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              isDelivered={false}
              returning={returning}
              returnedAt={returnedAt}
              retBusy={retBusy}
              onAdvance={handleAdvance}
              onReturn={handleReturn}
            />
          ))}
          {delivered.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              isDelivered
              returning={returning}
              returnedAt={returnedAt}
              retBusy={retBusy}
              onAdvance={handleAdvance}
              onReturn={handleReturn}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="text-sm font-bold text-[#101828]">Laporan Kembali ke Gudang</h2>
        <p className="text-xs text-[#667085]">
          Setelah pengiriman selesai, kirim laporan untuk kembali ke gudang asal. Rute kembali tampil kuning di peta admin.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {returning ? 'Dalam perjalanan kembali ke gudang asal' : returnedAt ? 'Tugas selesai — sudah kembali ke gudang' : 'Siap melapor kembali ke gudang'}
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
            <button onClick={() => handleReturn('complete')} disabled={retBusy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
              {retBusy ? 'Menyimpan...' : 'Tiba di Gudang - Selesai'}
            </button>
          ) : !returnedAt ? (
            <button onClick={() => handleReturn('start')} disabled={retBusy || delivered.length === 0} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
              {retBusy ? 'Menyimpan...' : 'Kirim Laporan Kembali ke Gudang'}
            </button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4E7EC] bg-[#F7F9FC] p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#101828]">Status GPS Perangkat</p>
            <p className="text-xs text-[#667085]">Periksa kembali status lokasi perangkat agar posisi & rute tetap terkirim ke admin.</p>
            {gpsResult && (
              <div className={`mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${gpsResult.on ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-red-100 text-[#F5222D]'}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: gpsResult.on ? '#16a34a' : '#dc2626' }} />
                {gpsResult.on ? `GPS Aktif · ${gpsResult.lat.toFixed(5)}, ${gpsResult.lng.toFixed(5)} · ${gpsResult.ts}` : `GPS Mati / Tidak Aktif · ${gpsResult.ts}`}
              </div>
            )}
          </div>
          <button onClick={checkGps} disabled={gpsChecking} className={btnGhost + ' shrink-0 disabled:opacity-50'}>
            {gpsChecking ? 'Memeriksa...' : 'Cek Status GPS'}
          </button>
        </div>
      </div>
    </div>
  );
}
