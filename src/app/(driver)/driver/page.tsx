'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DriverStatusCard from '@/components/DriverStatusCard';
import { formatDateTime, formatDate, STATUS_LABELS } from '@/lib/constants';
import { inputCls } from '@/components/ui';
import { getGPS } from '@/lib/gps';
import { Package, MapPin, Phone, Truck, Clock, Navigation, CheckCircle2, ArrowRight, FileText } from 'lucide-react';
import ShipmentQR from '@/components/ShipmentQR';
import DriverArrivalConfirm from '@/components/DriverArrivalConfirm';

type DailyReport = {
  id: string;
  reportDate: string;
  deliveredCount: number;
  failedCount: number;
  rescheduledCount: number;
  fuelLiter: number | null;
  notes: string | null;
};

const JOURNEY_STEP: Record<string, { label: string; bg: string; note: string }> = {
  WAREHOUSE_RECEIVED: { label: 'Kartu Jalan', bg: 'bg-[#F5222D] hover:bg-[#D41D25]', note: 'Cukup 1x scan gudang' },
  SORTING: { label: 'Kartu Jalan', bg: 'bg-[#F5222D] hover:bg-[#D41D25]', note: 'Cukup 1x scan gudang' },
  PICKED_UP: { label: 'Kartu Jalan', bg: 'bg-[#F5222D] hover:bg-[#D41D25]', note: 'Cukup 1x scan gudang' },
  DISPATCHED: { label: 'Mulai', bg: 'bg-[#16A34A] hover:bg-[#12873B]', note: 'Berangkat — mulai pengiriman' },
  IN_TRANSIT: { label: 'Tiba di Hub', bg: 'bg-amber-500 hover:bg-amber-600', note: 'Dalam perjalanan' },
  ARRIVED_AT_HUB: { label: 'Mulai Antar', bg: 'bg-[#0D6EFD] hover:bg-[#0B5ED7]', note: 'Siap antar ke penerima' },
  OUT_FOR_DELIVERY: { label: 'Selesai (Pod)', bg: 'bg-[#16B364] hover:bg-[#149954]', note: 'Sampai di penerima — buat laporan' },
};

const ADVANCE_STEP: Record<string, string> = {
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED_AT_HUB',
  ARRIVED_AT_HUB: 'OUT_FOR_DELIVERY',
};

const KARTU_CAPTION: Record<string, string> = {
  WAREHOUSE_RECEIVED: 'Cukup 1 kali scan gudang untuk verifikasi keberangkatan',
  SORTING: 'Cukup 1 kali scan gudang untuk verifikasi keberangkatan',
  PICKED_UP: 'Cukup 1 kali scan gudang untuk verifikasi keberangkatan',
  DISPATCHED: 'Klik tombol hijau untuk mulai perjalanan',
  IN_TRANSIT: 'Klik tombol kuning untuk melapor tiba di hub',
  ARRIVED_AT_HUB: 'Klik tombol biru untuk mulai mengantar',
  OUT_FOR_DELIVERY: 'Klik tombol hijau untuk menyelesaikan & buat laporan penerimaan',
  DELIVERED: 'Pengiriman selesai — kirim laporan kembali ke gudang',
  RETURNED: 'Pengiriman selesai',
};

type TaskType = {
  id: string;
  assignedAt: string;
  vehicle: { vehicleNumber: string } | null;
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    origin: string;
    destination: string;
    weight: number;
    receiver: { name: string; phone: string; address: string | null; city: string | null };
    sender: { name: string };
    events: { status: string; createdAt: string }[];
  };
};

export default function DriverHomePage() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [kartuMsg, setKartuMsg] = useState('');

  useEffect(() => {
    loadDriverStatus();
  }, []);

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveredCount, setDeliveredCount] = useState('');
  const [failedCount, setFailedCount] = useState('');
  const [rescheduledCount, setRescheduledCount] = useState('');
  const [fuelLiter, setFuelLiter] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  async function loadReports() {
    try {
      const res = await fetch('/api/driver/daily-report');
      if (res.ok) setReports((await res.json()).reports || []);
    } catch {}
  }

  const [advancingId, setAdvancingId] = useState('');

  const [returning, setReturning] = useState(false);
  const [returnedAt, setReturnedAt] = useState<string | null>(null);
  const [retBusy, setRetBusy] = useState(false);
  const [retMsg, setRetMsg] = useState('');
  const [arriveOpen, setArriveOpen] = useState(false);
  const [arriveDone, setArriveDone] = useState(false);

  async function loadDriverStatus() {
    try {
      const r = await fetch('/api/driver/status');
      if (r.ok) {
        const d = (await r.json()).driver;
        setEmployeeId(d.employeeId || '');
        setReturning(!!d.returning);
        setReturnedAt(d.returnedAt || null);
      }
    } catch {}
  }

  async function toggleReturn(action: 'start' | 'complete') {
    if (retBusy) return;
    if (action === 'complete' && returning) {
      setArriveOpen(true);
      return;
    }
    setRetBusy(true);
    setRetMsg('');
    try {
      const res = await fetch('/api/driver/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal menyimpan status kembali' }));
        setRetMsg(data.error || 'Gagal menyimpan status kembali');
      } else {
        setRetMsg(action === 'start' ? 'OK: Perjalanan kembali ke gudang asal dimulai.' : 'OK: Driver sudah tiba di gudang.');
        await loadDriverStatus();
      }
    } catch {
      setRetMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    setRetBusy(false);
  }

  function onArriveDone() {
    setArriveOpen(false);
    setArriveDone(true);
    setReturnedAt(new Date().toISOString());
    loadDriverStatus();
    loadTasks();
  }

  async function loadTasks() {
    try {
      const r = await fetch('/api/driver/tasks');
      if (!r.ok) {
        const d = await r.json();
        setErr(d.error || 'Gagal memuat tugas');
        return;
      }
      setTasks((await r.json()).assignments || []);
    } catch {
      setErr('Gagal memuat tugas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    loadReports();
  }, []);

  // Auto-refresh: pantau tugas secara otomatis tanpa reload manual.
  useEffect(() => {
    const id = setInterval(() => {
      loadTasks();
      loadDriverStatus();
    }, 20000);
    return () => clearInterval(id);
  }, []);

  async function advanceKartu(task: TaskType) {
    const shipment = task.shipment;
    const target = ADVANCE_STEP[shipment.status];
    if (!target) return;
    setAdvancingId(task.id);
    setKartuMsg('');
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await getGPS();
      lat = pos.lat;
      lng = pos.lng;
    } catch {}
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target, notes: `Kartu Jalan: ${shipment.status} -> ${target}`, lat, lng }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal memulai perjalanan' }));
        setKartuMsg(data.error || 'Gagal memulai perjalanan');
      } else {
        setKartuMsg(`OK: ${shipment.trackingNumber} → ${STATUS_LABELS[target]}`);
      }
    } catch {
      setKartuMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    await loadTasks();
    setAdvancingId('');
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    setSavingReport(true);
    setReportMsg('');
    try {
      const res = await fetch('/api/driver/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportDate,
          deliveredCount,
          failedCount,
          rescheduledCount,
          fuelLiter,
          notes: reportNotes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Gagal menyimpan laporan' }));
        setReportMsg(data.error || 'Gagal menyimpan laporan');
      } else {
        setReportMsg('Laporan harian tersimpan');
        setDeliveredCount('');
        setFailedCount('');
        setRescheduledCount('');
        setFuelLiter('');
        setReportNotes('');
        await loadReports();
      }
    } catch {
      setReportMsg('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    }
    setSavingReport(false);
  }

  if (loading) return <div className="py-20 text-center text-sm text-[#667085]">Memuat tugas...</div>;
  if (err) return <div className="py-20 text-center text-sm text-[#667085]">{err}</div>;

  const ACTIVE_JOURNEY = ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY'];
  const activeTasks = tasks.filter((t) => ACTIVE_JOURNEY.includes(t.shipment.status));
  const completedTasks = tasks.filter((t) => ['DELIVERED', 'RETURNED'].includes(t.shipment.status));
  const deliveredTasks = completedTasks.filter((t) => t.shipment.status === 'DELIVERED');
  const onHoldTasks = tasks.filter((t) => ['DELIVERY_FAILED', 'RESCHEDULED', 'RETURN_TO_SENDER'].includes(t.shipment.status));

  return (
    <div className="space-y-5">
      {/* Ringkasan cepat - mobile friendly */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-[#0D6EFD] p-4 text-white">
          <div className="flex items-center gap-2 text-blue-100"><Package size={16} /> Aktif</div>
          <div className="mt-1 text-2xl font-bold">{activeTasks.length}</div>
          <div className="text-xs text-blue-100">Tugas</div>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-[#E4E7EC]">
          <div className="flex items-center gap-2 text-[#667085]"><CheckCircle2 size={16} /> Selesai</div>
          <div className="mt-1 text-2xl font-bold text-[#101828]">{completedTasks.length}</div>
          <div className="text-xs text-[#667085]">Hari ini</div>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-[#E4E7EC]">
          <div className="flex items-center gap-2 text-[#667085]"><Truck size={16} /> Total</div>
          <div className="mt-1 text-2xl font-bold text-[#101828]">{tasks.length}</div>
          <div className="text-xs text-[#667085]">Penugasan</div>
        </div>
      </div>

      {/* Kartu Jalan — akses cepat di bagian atas, warna sesuai tahap perjalanan */}
      {activeTasks.length > 0 && (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#101828]"><FileText size={16} className="text-[#0D6EFD]" /> Kartu Jalan</h2>
            <span className="rounded-full bg-[#E7F0FF] px-3 py-1 text-xs font-semibold text-[#0D6EFD]">{activeTasks.length}</span>
          </div>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-1">
              {activeTasks.map((t) => {
                const shipment = t.shipment;
                const awaitingScan = ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP'].includes(shipment.status);
                const kj = JOURNEY_STEP[shipment.status] || { label: 'Lihat Detail', bg: 'bg-[#101828] hover:bg-black', note: '' };
                const isPOD = shipment.status === 'OUT_FOR_DELIVERY';
                const advancing = advancingId === t.id;
                return (
                  <div key={t.id} className="flex min-w-[150px] flex-col gap-1.5">
                    <button
                      onClick={() => {
                        if (awaitingScan) {
                          setKartuMsg(`${shipment.trackingNumber}: cukup 1 kali scan gudang untuk verifikasi keberangkatan. Tunjukkan QR ke penjaga gudang.`);
                          return;
                        }
                        if (isPOD) {
                          window.location.href = `/driver/tasks/${t.id}`;
                          return;
                        }
                        advanceKartu(t);
                      }}
                      disabled={advancing}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-4 text-white shadow ${kj.bg} disabled:opacity-50`}
                    >
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      {awaitingScan && (
                        <span className="rounded-md bg-white p-1"><ShipmentQR value={`DRV:${employeeId}:SHP:${shipment.id}`} size={48} /></span>
                      )}
                      <FileText size={16} /> {advancing ? 'Memproses...' : kj.label}
                    </span>
                      <span className="font-mono text-[11px] font-semibold opacity-90">{shipment.trackingNumber}</span>
                      <span className="text-[10px] opacity-80">{awaitingScan ? 'Cukup 1x scan gudang' : kj.note || shipment.destination}</span>
                    </button>
                    <Link href={`/driver/tasks/${t.id}`} className="text-center text-[11px] font-semibold text-[#0D6EFD] hover:underline">
                      Lihat Detail
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col justify-center rounded-xl bg-[#F7F9FC] px-4 py-3 lg:w-72 lg:shrink-0">
              <p className="text-lg font-extrabold leading-snug text-[#101828]">
                {KARTU_CAPTION[activeTasks[0].shipment.status] || 'Selesaikan pengiriman Anda satu per satu.'}
              </p>
              <p className="mt-1 text-sm text-[#667085]">
                Tombol berwarna mencerminkan tahap perjalanan. Tekan tombol Kartu Jalan untuk menjalankan langkah, atau «Lihat Detail» untuk memeriksa shipment.
              </p>
            </div>
          </div>
        </div>
      )}

      {kartuMsg && (
        <div className={`rounded-xl px-3 py-3 text-sm font-semibold ${kartuMsg.startsWith('OK:') ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-red-50 text-[#F5222D]'}`}>
          {kartuMsg}
        </div>
      )}

      {(deliveredTasks.length > 0 || returning) && !returnedAt && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-amber-800">
                {returning ? 'Dalam perjalanan kembali ke gudang asal' : 'Pengiriman selesai'}
              </p>
              <p className="text-xs text-amber-700">
                {returning
                  ? (completedTasks.length > 0 ? `${completedTasks.length} resi selesai. Aktifkan GPS, lalu tandai saat tiba di gudang.` : 'Aktifkan GPS, lalu tandai saat tiba di gudang.')
                  : `${deliveredTasks.length} resi selesai. Tekan tombol untuk mulai perjalanan kembali ke gudang asal.`}
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
            ) : (
              <button
                onClick={() => toggleReturn('start')}
                disabled={retBusy}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {retBusy ? 'Menyimpan...' : 'Kembali ke Gudang Asal'}
              </button>
            )}
          </div>
          {retMsg && (
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${retMsg.startsWith('OK:') ? 'bg-white text-[#16B364]' : 'bg-white text-[#F5222D]'}`}>
              {retMsg}
            </div>
          )}
          {arriveOpen && !arriveDone && (
            <div className="mt-3">
              <DriverArrivalConfirm onDone={onArriveDone} />
            </div>
          )}
        </div>
      )}

      {onHoldTasks.length > 0 && (
        <div className="rounded-xl bg-[#FEF6E7] px-4 py-3 text-sm text-[#92600A]">
          <b>{onHoldTasks.length} kiriman sedang ditunda</b> (gagal/jadwal ulang/return). Tidak perlu ditindak sampai ada instruksi lanjut.
        </div>
      )}

      <DriverStatusCard />

      {/* Daftar tugas sebagai kartu besar ramah jempol */}
      <div id="tugas">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#101828]">Tugas Aktif</h2>
          <span className="rounded-full bg-[#E7F0FF] px-3 py-1 text-xs font-semibold text-[#0D6EFD]">{activeTasks.length} tugas</span>
        </div>
        <div className="space-y-4">
          {activeTasks.map((t) => {
            const shipment = t.shipment;
            const lastEvent = shipment.events[0];
            const awaitingScan = ['WAREHOUSE_RECEIVED', 'SORTING', 'PICKED_UP'].includes(shipment.status);
            return (
              <div key={t.id} className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E7F0FF] text-[#0D6EFD]"><Package size={16} /></span>
                      <Link href={`/driver/tasks/${t.id}`} className="font-mono text-sm font-bold text-[#0D6EFD] hover:underline">
                        {shipment.trackingNumber}
                      </Link>
                    </div>
                    <div className="mt-2"><StatusBadge status={shipment.status} /></div>
                  </div>
                  {t.vehicle && <div className="flex items-center gap-1.5 rounded-full bg-[#F7F9FC] px-3 py-1.5 text-xs font-semibold text-[#344054]"><Truck size={14} /> {t.vehicle.vehicleNumber}</div>}
                </div>

                <div className="mt-4 rounded-xl bg-[#F7F9FC] p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#667085]"><MapPin size={14} /> Penerima</div>
                  <div className="mt-1 font-semibold text-[#101828]">{shipment.receiver.name}</div>
                  {(shipment.receiver.address || shipment.receiver.city) && <div className="text-sm text-[#344054]">{shipment.receiver.address}{shipment.receiver.city ? `, ${shipment.receiver.city}` : ''}</div>}
                  <a href={`tel:${shipment.receiver.phone}`} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#0D6EFD] border border-[#E4E7EC] active:bg-[#E7F0FF]">
                    <Phone size={16} /> {shipment.receiver.phone}
                  </a>
                </div>

                <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-[#E4E7EC] p-3 text-sm">
                  <div className="flex items-center gap-2 text-[#344054]"><Navigation size={14} className="text-[#667085]" /> <b className="text-[#101828]">{shipment.origin}</b> <ArrowRight size={14} className="text-[#667085]" /> <b className="text-[#101828]">{shipment.destination}</b></div>
                  <div className="flex gap-4 text-xs text-[#667085]">
                    <span className="flex items-center gap-1"><Package size={12} /> {shipment.weight} kg</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {lastEvent ? STATUS_LABELS[lastEvent.status] : '-'}</span>
                  </div>
                </div>

                {awaitingScan && (
                  <div className="mt-3 rounded-xl border-2 border-[#0D6EFD]/15 bg-[#EFF6FF] p-3 text-center">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#0D6EFD]">QR Keberangkatan</div>
                    <div className="mt-2 flex justify-center">
                      <div className="rounded-xl bg-white p-2 shadow-sm">
                        <ShipmentQR value={`DRV:${employeeId}:SHP:${shipment.id}`} size={110} />
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-xs font-bold text-[#0D6EFD]">{shipment.trackingNumber}</div>
                    <div className="text-[11px] text-[#667085]">Driver: {employeeId || '-'}</div>
                    <div className="text-[11px] text-[#667085]">Minta scan ke penjaga gudang</div>
                  </div>
                )}

                <Link href={`/driver/tasks/${t.id}`} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#0D6EFD] border border-[#D9E6FF] bg-[#EFF6FF] active:bg-[#E1EEFF]">
                  Lihat Detail <ArrowRight size={16} />
                </Link>
                <div className="mt-1 text-center text-xs text-[#667085]">Ditugaskan {formatDateTime(t.assignedAt)}</div>
              </div>
            );
          })}
          {activeTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E4E7EC] bg-white p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F9FC] text-[#667085]"><Package size={20} /></div>
              <div className="mt-3 text-sm font-semibold text-[#101828]">Tidak ada penugasan aktif</div>
              <div className="text-xs text-[#667085]">{completedTasks.length > 0 ? `${completedTasks.length} tugas sudah selesai hari ini.` : 'Istirahat sejenak, tugas baru akan muncul di sini.'}</div>
            </div>
          )}
        </div>
      </div>

      {completedTasks.length > 0 && (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#101828]"><CheckCircle2 size={16} className="text-[#16B364]" /> Selesai ({completedTasks.length})</h2>
          <div className="mt-3 space-y-2">
            {completedTasks.map((t) => (
              <Link key={t.id} href={`/driver/tasks/${t.id}`} className="flex items-center justify-between rounded-xl border border-[#F0F2F5] bg-[#F7F9FC] px-3 py-3 active:bg-white">
                <div>
                  <div className="font-mono text-xs font-bold text-[#0D6EFD]">{t.shipment.trackingNumber}</div>
                  <div className="text-sm font-medium text-[#101828]">{t.shipment.receiver.name}</div>
                </div>
                <StatusBadge status={t.shipment.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
        <h2 className="text-base font-bold text-[#101828]">Laporan Harian</h2>
        <p className="text-sm text-[#667085]">Rekap hari ini untuk admin. Tombol besar mudah dijangkau jempol.</p>
        <form onSubmit={submitReport} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Tanggal</label>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={`${inputCls} h-12`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Paket Terkirim</label>
              <input type="number" inputMode="numeric" min="0" value={deliveredCount} onChange={(e) => setDeliveredCount(e.target.value)} className={`${inputCls} h-12 text-base`} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Paket Gagal</label>
              <input type="number" inputMode="numeric" min="0" value={failedCount} onChange={(e) => setFailedCount(e.target.value)} className={`${inputCls} h-12 text-base`} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Dijadwalkan Ulang</label>
              <input type="number" inputMode="numeric" min="0" value={rescheduledCount} onChange={(e) => setRescheduledCount(e.target.value)} className={`${inputCls} h-12 text-base`} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#667085]">BBM (liter)</label>
              <input type="number" inputMode="decimal" min="0" step="0.1" value={fuelLiter} onChange={(e) => setFuelLiter(e.target.value)} className={`${inputCls} h-12 text-base`} placeholder="5.5" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#667085]">Catatan / Kendala</label>
              <input value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} className={`${inputCls} h-12 text-base`} placeholder="Kendala di lapangan, dsb" />
            </div>
          </div>
          <button type="submit" disabled={savingReport} className="flex h-12 w-full items-center justify-center rounded-xl bg-[#0D6EFD] text-sm font-bold text-white shadow hover:bg-[#0B5ED7] disabled:opacity-50">
            {savingReport ? 'Menyimpan...' : 'Simpan Laporan Harian'}
          </button>
          {reportMsg && <div className={`rounded-xl px-3 py-2 text-sm ${reportMsg.startsWith('Laporan') ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-[#FEF0F0] text-[#F5222D]'}`}>{reportMsg}</div>}
        </form>

        {reports.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-bold uppercase text-[#667085]">Riwayat Laporan</h3>
            <div className="mt-3 space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-3 text-sm">
                  <div className="flex items-center justify-between"><span className="font-semibold text-[#101828]">{formatDate(r.reportDate)}</span><span className="text-xs text-[#667085]">{r.fuelLiter != null ? `${r.fuelLiter} L` : '-'}</span></div>
                  <div className="mt-1 flex gap-3 text-xs"><span className="text-[#16B364]">Terkirim {r.deliveredCount}</span><span className="text-[#F5222D]">Gagal {r.failedCount}</span><span className="text-[#667085]">Tunda {r.rescheduledCount}</span></div>
                  {r.notes && <div className="mt-1 text-xs text-[#344054]">{r.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
