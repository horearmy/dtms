"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import DriverLiveMap from '@/components/DriverLiveMap';
import { formatDateTime } from '@/lib/constants';
import { ClipboardList, FileText } from 'lucide-react';

type DriverStatus = {
  driver: {
    id: string;
    name: string;
    employeeId: string;
    photo: string | null;
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
      try {
        const res = await fetch('/api/driver/status');
        if (res.ok && !cancelled) setData(await res.json());
      } catch {}
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
    <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Menu akses cepat driver */}
      <div className="flex flex-col items-center text-center">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${onDuty ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-[#F7F9FC] text-[#667085]'}`}>
          {onDuty ? 'Sedang Bertugas' : 'Tidak Ada Tugas Aktif'}
        </span>

        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <a
            href="#tugas"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-4 transition hover:border-[#0D6EFD]/30 hover:bg-[#EFF6FF] active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D6EFD] text-white">
              <ClipboardList size={20} />
            </span>
            <span className="text-sm font-bold text-[#101828]">Tugas</span>
          </a>
          <Link
            href="/driver/laporan"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-4 transition hover:border-[#0D6EFD]/30 hover:bg-[#EFF6FF] active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#16B364] text-white">
              <FileText size={20} />
            </span>
            <span className="text-sm font-bold text-[#101828]">Laporan</span>
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-[#F7F9FC] p-3">
          <div className="text-[11px] uppercase text-[#667085]">Nama / ID</div>
          <div className="mt-1 text-sm font-bold text-[#101828]">{d.name}</div>
          <div className="font-mono text-xs text-[#667085]">{d.employeeId}</div>
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3">
          <div className="text-[11px] uppercase text-[#667085]">Kendaraan Aktif</div>
          {d.vehicle ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-[#101828]">{d.vehicle.vehicleNumber}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.vehicle.returning ? 'bg-[#FFF2E0] text-[#FF8A00]' : 'bg-[#E6F9EF] text-[#16B364]'}`}>
                  {d.vehicle.returning ? 'Kembali' : 'Bertugas'}
                </span>
              </div>
              <div className="text-xs text-[#667085]">{d.vehicle.type} · {d.vehicle.status}</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-[#667085]">Belum ada kendaraan</div>
          )}
        </div>

        <div className="rounded-lg bg-[#F7F9FC] p-3">
          <div className="text-[11px] uppercase text-[#667085]">Status GPS</div>
          {gps ? (
            <>
              <div className={`mt-1 flex items-center gap-2 text-sm font-bold ${gps.latitude != null ? 'text-[#16B364]' : 'text-[#F5222D]'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: gps.latitude != null ? '#16B364' : '#F5222D' }} />
                {gps.latitude != null ? 'Aktif' : 'Mati'}
              </div>
              <div className="text-xs text-[#667085]">
                {gps.latitude != null ? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}` : 'Belum ada sinyal'}
                {gps.speed != null ? ` · ${gps.speed} km/h` : ''}
              </div>
              <div className="text-[11px] text-[#667085]">{formatDateTime(gps.createdAt)}</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-[#667085]">Belum ada sinyal GPS</div>
          )}
        </div>
      </div>

      {onDuty && d.active && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase text-[#0D6EFD]">Shipment Aktif · Sedang dalam Perjalanan</div>
              <div className="mt-1 flex items-center gap-2">
                <Link href={`/driver/tasks`} className="font-mono text-sm font-bold text-[#0D6EFD] hover:underline">
                  {d.active.trackingNumber}
                </Link>
                <StatusBadge status={d.active.status} />
              </div>
              <p className="mt-1 text-xs text-[#667085]">
                <b>{d.active.origin}</b> → <b>{d.active.destination}</b>
              </p>
              <p className="text-xs text-[#667085]">
                Penerima: {d.active.receiverName} · {d.active.receiverAddress}, {d.active.receiverCity}
              </p>
            </div>
            <Link href="/driver/laporan" className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D6EFD] transition hover:bg-[#F7F9FC]">
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
