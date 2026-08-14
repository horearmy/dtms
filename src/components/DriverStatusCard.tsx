"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DriverLiveMap from '@/components/DriverLiveMap';
import { formatDateTime } from '@/lib/constants';

type DriverStatus = {
  driver: {
    id: string;
    name: string;
    employeeId: string;
    status: string;
    returning: boolean;
    returnedAt: string | null;
    returnStartedAt: string | null;
    vehicle: {
      id: string;
      vehicleNumber: string;
      type: string;
      status: string;
      returning: boolean;
    } | null;
    gps: { latitude: number; longitude: number; speed: number | null; battery: number | null; createdAt: string } | null;
    active: {
      id: string;
      trackingNumber: string;
      status: string;
      origin: string;
      destination: string;
      originLat: number | null;
      originLng: number | null;
      destLat: number | null;
      destLng: number | null;
      receiverName: string;
      receiverAddress: string | null;
      receiverCity: string | null;
    } | null;
  };
};

export default function DriverStatusCard() {
  const [data, setData] = useState<DriverStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch('/api/driver/status');
      if (res.ok && !cancelled) setData(await res.json());
      if (!cancelled) setLoading(false);
    }
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (loading) return null;
  if (!data) return null;

  const d = data.driver;
  const onDuty = !!d.active;
  const gps = d.gps;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">🪪 Keterangan Driver</h2>
          <p className="text-xs text-slate-500">Data Anda &amp; kendaraan yang sedang digunakan</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${onDuty ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {onDuty ? 'Sedang Bertugas' : 'Tidak Ada Tugas Aktif'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-[11px] uppercase text-slate-400">Nama / ID</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{d.name}</div>
          <div className="font-mono text-xs text-slate-500">{d.employeeId}</div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-[11px] uppercase text-slate-400">Kendaraan Aktif</div>
          {d.vehicle ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{d.vehicle.vehicleNumber}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.vehicle.returning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {d.vehicle.returning ? 'Kembali' : 'Bertugas'}
                </span>
              </div>
              <div className="text-xs text-slate-500">{d.vehicle.type} · {d.vehicle.status}</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-400">Belum ada kendaraan</div>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-[11px] uppercase text-slate-400">Status GPS</div>
          {gps ? (
            <>
              <div className={`mt-1 flex items-center gap-2 text-sm font-bold ${gps.latitude != null ? 'text-emerald-700' : 'text-red-600'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: gps.latitude != null ? '#16a34a' : '#dc2626' }} />
                {gps.latitude != null ? 'Aktif' : 'Mati'}
              </div>
              <div className="text-xs text-slate-500">
                {gps.latitude != null ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'Belum ada sinyal'}
                {gps.speed != null ? ` · ${gps.speed} km/h` : ''}
              </div>
              <div className="text-[11px] text-slate-400">{formatDateTime(gps.createdAt)}</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-400">Belum ada sinyal GPS</div>
          )}
        </div>
      </div>

      {onDuty && d.active && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase text-blue-500">Shipment Aktif · Sedang dalam Perjalanan</div>
              <div className="mt-1 flex items-center gap-2">
                <Link href={`/driver/tasks`} className="font-mono text-sm font-bold text-brand-600 hover:underline">
                  {d.active.trackingNumber}
                </Link>
                <StatusBadge status={d.active.status} />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                <b>{d.active.origin}</b> → <b>{d.active.destination}</b>
              </p>
              <p className="text-xs text-slate-500">
                Penerima: {d.active.receiverName} · {d.active.receiverAddress}, {d.active.receiverCity}
              </p>
            </div>
            <Link href="/driver/laporan" className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">
              📋 Buka Laporan
            </Link>
          </div>
        </div>
      )}

      {d.returning && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          🚚 Dalam perjalanan kembali ke gudang {d.returnStartedAt ? `sejak ${formatDateTime(d.returnStartedAt)}` : ''}
        </div>
      )}

      <div className="mt-4">
        <DriverLiveMap
          driverLat={gps?.latitude ?? null}
          driverLng={gps?.longitude ?? null}
          destLat={d.active?.destLat ?? null}
          destLng={d.active?.destLng ?? null}
          destination={d.active?.destination || ''}
        />
      </div>
    </div>
  );
}
