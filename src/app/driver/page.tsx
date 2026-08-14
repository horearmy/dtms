"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DriverStatusCard from '@/components/DriverStatusCard';
import { formatDateTime, formatDate, STATUS_LABELS } from '@/lib/constants';
import { inputCls, btnPrimary } from '@/components/ui';

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
    const res = await fetch('/api/driver/daily-report');
    if (res.ok) setReports((await res.json()).reports || []);
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
    if (!res.ok) setReportMsg((await res.json()).error || 'Gagal menyimpan laporan');
    else {
      setReportMsg('Laporan harian tersimpan ✓');
      setDeliveredCount('');
      setFailedCount('');
      setRescheduledCount('');
      setFuelLiter('');
      setReportNotes('');
      await loadReports();
    }
    setSavingReport(false);
  }

  if (loading) return <div className="py-20 text-center text-slate-400">Memuat tugas...</div>;
  if (err) return <div className="py-20 text-center text-slate-500">{err}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tugas Hari Ini</h1>
        <p className="text-sm text-slate-500">{tasks.length} penugasan</p>
      </div>

      {/* Keterangan driver & kendaraan aktif + peta live */}
      <DriverStatusCard />

      <div className="space-y-3">
        {tasks.map((t) => {
          const shipment = t.shipment;
          const lastEvent = shipment.events[0];
          const isDispatched = shipment.status === 'DISPATCHED';
          const deliverable = shipment.status === 'OUT_FOR_DELIVERY';
          const done = shipment.status === 'DELIVERED' || shipment.status === 'RETURNED';
          return (
            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/driver/tasks/${t.id}`} className="font-mono text-sm font-bold text-brand-600 hover:underline">
                    {shipment.trackingNumber}
                  </Link>
                  <div className="mt-1"><StatusBadge status={shipment.status} /></div>
                </div>
                {t.vehicle && <div className="text-xs text-slate-500">{t.vehicle.vehicleNumber}</div>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase text-slate-400">Penerima</div>
                  <div className="font-semibold text-slate-800">{shipment.receiver.name}</div>
                  <div className="text-xs text-slate-500">{shipment.receiver.address}, {shipment.receiver.city}</div>
                  <div className="text-xs text-slate-500">{shipment.receiver.phone}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-slate-400">Pengiriman</div>
                  <div className="text-xs text-slate-600"><b>Asal:</b> {shipment.origin}</div>
                  <div className="text-xs text-slate-600"><b>Tujuan:</b> {shipment.destination}</div>
                  <div className="text-xs text-slate-600"><b>Berat:</b> {shipment.weight} kg</div>
                  <div className="text-xs text-slate-500">Status: {lastEvent ? STATUS_LABELS[lastEvent.status] : '-'}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href={`/driver/tasks/${t.id}`} className={btnPrimary}>
                  {isDispatched ? 'Mulai Pengiriman' : deliverable ? 'Proses Delivery & POD' : done ? 'Lihat Laporan' : 'Lihat Detail'}
                </Link>
                <span className="text-xs text-slate-400">Ditugaskan {formatDateTime(t.assignedAt)}</span>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            Tidak ada penugasan saat ini
          </div>
        )}
      </div>

      {/* Laporan Harian */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Laporan Harian</h2>
        <p className="text-xs text-slate-500">Rekap pengiriman hari ini sebagai laporan kepada admin.</p>

        <form onSubmit={submitReport} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tanggal</label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Paket Terkirim</label>
            <input type="number" min="0" value={deliveredCount} onChange={(e) => setDeliveredCount(e.target.value)} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Paket Gagal</label>
            <input type="number" min="0" value={failedCount} onChange={(e) => setFailedCount(e.target.value)} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Dijadwalkan Ulang</label>
            <input type="number" min="0" value={rescheduledCount} onChange={(e) => setRescheduledCount(e.target.value)} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">BBM (liter)</label>
            <input type="number" min="0" step="0.1" value={fuelLiter} onChange={(e) => setFuelLiter(e.target.value)} className={inputCls} placeholder="mis. 5.5" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Catatan / Kendala</label>
            <input value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} className={inputCls} placeholder="Kendala di lapangan, dsb" />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={savingReport} className={btnPrimary}>
              {savingReport ? 'Menyimpan...' : 'Simpan Laporan Harian'}
            </button>
            {reportMsg && (
              <span className={`ml-3 text-sm ${reportMsg.startsWith('Laporan') ? 'text-emerald-600' : 'text-red-600'}`}>{reportMsg}</span>
            )}
          </div>
        </form>

        {reports.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Terkirim</th>
                  <th className="py-2 pr-4">Gagal</th>
                  <th className="py-2 pr-4">Dijadwalkan Ulang</th>
                  <th className="py-2 pr-4">BBM</th>
                  <th className="py-2">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-semibold text-slate-800">{formatDate(r.reportDate)}</td>
                    <td className="py-2 pr-4 text-emerald-600">{r.deliveredCount}</td>
                    <td className="py-2 pr-4 text-red-600">{r.failedCount}</td>
                    <td className="py-2 pr-4 text-slate-700">{r.rescheduledCount}</td>
                    <td className="py-2 pr-4 text-slate-700">{r.fuelLiter != null ? `${r.fuelLiter} L` : '-'}</td>
                    <td className="py-2 text-slate-600">{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
