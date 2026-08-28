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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) { setData(null); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const res = await fetch(`/api/drivers/${driverId}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Sesi tidak valid atau akses ditolak.' : `Gagal memuat detail driver (${res.status}).`);
        const nextData = await res.json() as DriverDetail;
        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Detail driver tidak dapat dimuat. Periksa koneksi lalu coba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [driverId]);

  if (!driverId) return null;

  const d = data?.driver;

  return (
    <Modal open onClose={onClose} title="Detail Driver" wide>
      {loading && !d && <div className="py-10 text-center text-sm text-[#667085]">Memuat detail driver...</div>}

      {error && !d && (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm text-[#F5222D]">{error}</p>
          <button onClick={() => window.location.reload()} className={btnGhost}>Muat ulang halaman</button>
        </div>
      )}

      {error && d && <p className="text-xs text-[#B54708]">Pembaruan terakhir gagal. Data yang tampil mungkin belum terbaru.</p>}

      {d && (
        <div className="space-y-4">
          {/* Identitas */}
          <div className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] p-4">
            {d.photo ? (
              <img src={d.photo} alt={d.name} className="h-14 w-14 rounded-full border-2 border-white object-cover shadow" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F0FF] text-lg font-bold text-[#0D6EFD]">
                {d.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-[#101828]">{d.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${d.status === 'ACTIVE' ? 'bg-[#E6F9EF] text-[#16B364]' : 'bg-[#F7F9FC] text-[#667085]'}`}>
                  {d.status}
                </span>
              </div>
              <div className="font-mono text-xs text-[#667085]">{d.employeeId}{d.username ? ` · @${d.username}` : ''}</div>
              <div className="text-xs text-[#667085]">{d.phone} · {d.assignmentCount} penugasan</div>
            </div>
          </div>

          {/* Status perjalanan */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E4E7EC] p-4">
              <div className="text-[11px] uppercase text-[#667085]">Status Perjalanan</div>
              {d.active ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#0D6EFD]">{d.active.trackingNumber}</span>
                    <StatusBadge status={d.active.status} />
                  </div>
                  <p className="mt-1 text-xs text-[#667085]"><b>{d.active.origin}</b> → <b>{d.active.destination}</b></p>
                  <p className="text-xs text-[#667085]">Penerima: {d.active.receiverName} · {d.active.receiverAddress}, {d.active.receiverCity}</p>
                </div>
              ) : (
                <div className="mt-1 text-sm text-[#667085]">
                  {d.returning ? '🚚 Dalam perjalanan kembali ke gudang' : 'Tidak ada pengiriman aktif'}
                  {d.returnedAt ? ` · Kembali terakhir: ${formatDateTime(d.returnedAt)}` : ''}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#E4E7EC] p-4">
              <div className="text-[11px] uppercase text-[#667085]">Kendaraan yang Digunakan</div>
              {d.vehicle ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#101828]">{d.vehicle.vehicleNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.vehicle.returning ? 'bg-[#FFF2E0] text-[#FF8A00]' : 'bg-[#E6F9EF] text-[#16B364]'}`}>
                      {d.vehicle.returning ? 'Kembali' : 'Bertugas'}
                    </span>
                  </div>
                  <div className="text-xs text-[#667085]">{d.vehicle.type} · {d.vehicle.status}</div>
                  <div className="text-xs text-[#667085]">Jarak tempuh: {d.vehicle.totalDistanceKm.toLocaleString('id-ID')} km</div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-[#667085]">Belum ada kendaraan ditugaskan</div>
              )}
            </div>
          </div>

          {/* Posisi GPS */}
          <div className="rounded-xl border border-[#E4E7EC] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] uppercase text-[#667085]">Posisi GPS Terakhir</div>
              {d.gps && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#16B364]">
                  <span className="h-2 w-2 rounded-full bg-[#16B364]" />
                  {d.gps.latitude.toFixed(5)}, {d.gps.longitude.toFixed(5)}
                </span>
              )}
            </div>
            {d.gps && (
              <div className="mt-1 text-xs text-[#667085]">
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
