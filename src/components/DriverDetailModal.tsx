"use client";

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import DriverLiveMap from '@/components/DriverLiveMap';
import { Modal, btnGhost } from '@/components/ui';
import { formatDateTime } from '@/lib/constants';

type DriverDetail = {
  driver: {
    id: string;
    employeeId: string;
    name: string;
    phone: string;
    photo: string | null;
    status: string;
    returning: boolean;
    returnedAt: string | null;
    returnStartedAt: string | null;
    username: string | null;
    assignmentCount: number;
    vehicle: {
      id: string;
      vehicleNumber: string;
      type: string;
      status: string;
      returning: boolean;
      totalDistanceKm: number;
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

export default function DriverDetailModal({ driverId, onClose }: { driverId: string | null; onClose: () => void }) {
  const [data, setData] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    async function load() {
      const res = await fetch(`/api/drivers/${driverId}`);
      if (res.ok && !cancelled) setData(await res.json());
      setLoading(false);
    }
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [driverId]);

  if (!driverId) return null;

  const d = data?.driver;

  return (
    <Modal open onClose={onClose} title="Detail Driver" wide>
      {loading && !d && <div className="py-10 text-center text-sm text-slate-400">Memuat detail driver...</div>}

      {d && (
        <div className="space-y-4">
          {/* Identitas */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            {d.photo ? (
              <img src={d.photo} alt={d.name} className="h-14 w-14 rounded-full border-2 border-white object-cover shadow" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                {d.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-slate-900">{d.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                  {d.status}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-500">{d.employeeId}{d.username ? ` · @${d.username}` : ''}</div>
              <div className="text-xs text-slate-500">{d.phone} · {d.assignmentCount} penugasan</div>
            </div>
          </div>

          {/* Status perjalanan */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase text-slate-400">Status Perjalanan</div>
              {d.active ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-brand-600">{d.active.trackingNumber}</span>
                    <StatusBadge status={d.active.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600"><b>{d.active.origin}</b> → <b>{d.active.destination}</b></p>
                  <p className="text-xs text-slate-500">Penerima: {d.active.receiverName} · {d.active.receiverAddress}, {d.active.receiverCity}</p>
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-500">
                  {d.returning ? '🚚 Dalam perjalanan kembali ke gudang' : 'Tidak ada pengiriman aktif'}
                  {d.returnedAt ? ` · Kembali terakhir: ${formatDateTime(d.returnedAt)}` : ''}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase text-slate-400">Kendaraan yang Digunakan</div>
              {d.vehicle ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{d.vehicle.vehicleNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.vehicle.returning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {d.vehicle.returning ? 'Kembali' : 'Bertugas'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{d.vehicle.type} · {d.vehicle.status}</div>
                  <div className="text-xs text-slate-500">Jarak tempuh: {d.vehicle.totalDistanceKm.toLocaleString('id-ID')} km</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-500">Belum ada kendaraan ditugaskan</div>
              )}
            </div>
          </div>

          {/* Posisi GPS */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] uppercase text-slate-400">Posisi GPS Terakhir</div>
              {d.gps && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {d.gps.latitude.toFixed(5)}, {d.gps.longitude.toFixed(5)}
                </span>
              )}
            </div>
            {d.gps && (
              <div className="mt-1 text-xs text-slate-500">
                Update: {formatDateTime(d.gps.createdAt)}
                {d.gps.speed != null ? ` · Kecepatan: ${d.gps.speed} km/h` : ''}
                {d.gps.battery != null ? ` · Baterai: ${d.gps.battery}%` : ''}
              </div>
            )}
          </div>

          {/* Peta */}
          <DriverLiveMap
            driverLat={d.gps?.latitude ?? null}
            driverLng={d.gps?.longitude ?? null}
            destLat={d.active?.destLat ?? null}
            destLng={d.active?.destLng ?? null}
            destination={d.active?.destination || ''}
          />

          <div className="flex justify-end pt-1">
            <button onClick={onClose} className={btnGhost}>Tutup</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
