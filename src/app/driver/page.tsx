"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { formatDateTime, STATUS_LABELS } from '@/lib/constants';

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

export default function DriverHomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

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
  }, []);

  if (loading) return <div className="py-20 text-center text-slate-400">Memuat tugas...</div>;
  if (err) return <div className="py-20 text-center text-slate-500">{err}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Tugas Hari Ini</h1>
        <p className="text-sm text-slate-500">{tasks.length} penugasan aktif</p>
      </div>

      <div className="space-y-3">
        {tasks.map((t) => {
          const shipment = t.shipment;
          const lastEvent = shipment.events[0];
          const deliverable = shipment.status === 'OUT_FOR_DELIVERY';
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
                <Link href={`/driver/tasks/${t.id}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  {deliverable ? 'Proses Delivery & POD' : 'Lihat Detail'}
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
    </div>
  );
}