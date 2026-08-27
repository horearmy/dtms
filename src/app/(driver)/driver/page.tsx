'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DriverStatusCard from '@/components/DriverStatusCard';
import { formatDateTime, formatDate, STATUS_LABELS } from '@/lib/constants';
import { inputCls, btnPrimary } from '@/components/ui';
import { Package, MapPin, Phone, Truck, Clock, Navigation, CheckCircle2, ArrowRight } from 'lucide-react';
import ShipmentQR from '@/components/ShipmentQR';

type Task = {
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

type DailyReport = {
  id: string;
  reportDate: string;
  deliveredCount: number;
  failedCount: number;
  rescheduledCount: number;
  fuelLiter: number | null;
  notes: string | null;
};

export default function DriverHomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

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

  useEffect(() => {
    fetch('/api/driver/tasks')
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json();
          setErr(d.error || 'Gagal memuat tugas');
          return;
        }
        setTasks((await r.json()).assignments || []);
      })
      .catch(() => setErr('Gagal memuat tugas'))
      .finally(() => setLoading(false));
    loadReports();
  }, []);

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

  const activeTasks = tasks.filter((t) => !['DELIVERED', 'RETURNED', 'RETURN_TO_SENDER'].includes(t.shipment.status));
  const completedTasks = tasks.filter((t) => ['DELIVERED', 'RETURNED', 'RETURN_TO_SENDER'].includes(t.shipment.status));

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
            const isDispatched = shipment.status === 'DISPATCHED';
            const deliverable = shipment.status === 'OUT_FOR_DELIVERY';
            const actionLabel = isDispatched ? 'Mulai Pengiriman' : deliverable ? 'Proses Delivery & POD' : 'Lihat Detail';
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

                {isDispatched && (
                  <div className="mt-3 rounded-xl border-2 border-[#0D6EFD]/15 bg-[#EFF6FF] p-3 text-center">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[#0D6EFD]">QR Keberangkatan</div>
                    <div className="mt-2 flex justify-center">
                      <div className="rounded-xl bg-white p-2 shadow-sm">
                        <ShipmentQR value={shipment.trackingNumber} size={110} />
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-xs font-bold text-[#0D6EFD]">{shipment.trackingNumber}</div>
                    <div className="text-[11px] text-[#667085]">Minta scan ke penjaga gudang</div>
                  </div>
                )}

                <Link href={`/driver/tasks/${t.id}`} className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow ${deliverable ? 'bg-[#16B364] hover:bg-[#149954]' : isDispatched ? 'bg-[#0D6EFD] hover:bg-[#0B5ED7]' : 'bg-[#101828] hover:bg-black'}`}>
                  {actionLabel} <ArrowRight size={16} />
                </Link>
                <div className="mt-2 text-center text-xs text-[#667085]">Ditugaskan {formatDateTime(t.assignedAt)}</div>
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
