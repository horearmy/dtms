"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateTime } from '@/lib/constants';

type ReturnPoint = {
  latitude: number;
  longitude: number;
  speed: number | null;
  battery: number | null;
  createdAt: string;
};

type ReturnData = {
  driver: { id: string; name: string; returning: boolean; returnStartedAt: string | null; returnedAt: string | null };
  warehouse: { name: string | null; lat: number | null; lng: number | null };
  return: { estimatedBackAt: string } | null;
  beforeReturn: { latitude: number; longitude: number; createdAt: string } | null;
  points: ReturnPoint[];
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ReturnTimeline({ driverId, driverName }: { driverId?: string | null; driverName?: string | null }) {
  const [data, setData] = useState<ReturnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const areaRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!driverId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/gps/return-timeline?driverId=${driverId}`);
      if (!res.ok) { setErr('Gagal memuat perjalanan kembali'); return; }
      const d = (await res.json()) as ReturnData;
      setData(d);
      setLastUpdate(new Date().toLocaleTimeString('id-ID'));
    } catch {
      setErr('Gagal memuat perjalanan kembali');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    setLoading(true);
    setErr('');
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // auto-scroll ke bawah (titik terbaru) saat update
  useEffect(() => {
    const el = areaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.points.length]);

  if (!driverId) return null;
  const hasReturn = !!data && !!(data.driver.returnStartedAt && (data.points.length > 0 || data.driver.returning || data.driver.returnedAt));

  // jarak tempuh selama kembali + sisa ke gudang
  let traveledKm = 0;
  let remainingKm: number | null = null;
  if (data?.points.length) {
    for (let i = 1; i < data.points.length; i++) {
      traveledKm += haversineKm(data.points[i - 1].latitude, data.points[i - 1].longitude, data.points[i].latitude, data.points[i].longitude);
    }
    const last = data.points[data.points.length - 1];
    if (data.warehouse.lat != null && data.warehouse.lng != null) {
      remainingKm = haversineKm(last.latitude, last.longitude, data.warehouse.lat, data.warehouse.lng);
    }
  }
  const points = data?.points || [];

  return (
    <div className={`rounded-xl border bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${hasReturn ? 'border-amber-200' : 'border-[#E4E7EC]'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#101828]">🚚 Timeline Perjalanan Kembali</h2>
        {hasReturn && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#667085]">Update {lastUpdate}</span>
        )}
      </div>

      {!hasReturn && !loading && (
        <p className="py-3 text-center text-sm text-[#667085]">
          Belum ada perjalanan kembali{driverName ? ` — tunggu ${driverName} melapor kembali ke gudang` : ''}.
        </p>
      )}

      {loading && !data && <p className="py-3 text-center text-sm text-[#667085]">Memuat…</p>}
      {err && <p className="py-2 text-center text-sm text-[#F5222D]">{err}</p>}

      {hasReturn && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {data!.driver.returning ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                Sedang kembali ke gudang
              </span>
            ) : (
              <span className="rounded-full bg-[#E6F9EF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#16B364]">
                ✓ Selesai kembali — {formatDateTime(data!.return?.estimatedBackAt ?? data!.driver.returnedAt)}
              </span>
            )}
            <span className="text-[11px] text-[#667085]">
              Mulai {data!.driver.returnStartedAt ? formatDateTime(data!.driver.returnStartedAt) : '-'}
            </span>
          </div>

          <div className="mb-2 space-y-1 text-xs text-[#667085]">
            {traveledKm > 0 && <div><b>Jarak ditempuh:</b> {traveledKm.toFixed(1)} km</div>}
            {remainingKm != null && (
              <div><b>Sisa ke gudang {data!.warehouse.name || ''}:</b> {remainingKm.toFixed(1)} km</div>
            )}
            {points.length > 0 && (
              <div className="font-mono text-[#667085]">
                Lokasi terakhir: {points[points.length - 1].latitude.toFixed(5)}, {points[points.length - 1].longitude.toFixed(5)}
              </div>
            )}
          </div>

          {points.length > 0 ? (
            <div ref={areaRef} className="max-h-72 space-y-0 overflow-y-auto pr-1">
              {points.map((p, i) => (
                <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i !== points.length - 1 && <span className="absolute left-[7px] top-4 h-full w-0.5 bg-amber-200" />}
                  <span className="relative mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                    <span className={`h-4 w-4 rounded-full border-4 ${i === points.length - 1 ? 'border-amber-300 bg-amber-500' : 'border-amber-200 bg-amber-400'}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${i === points.length - 1 ? 'font-bold text-amber-700' : 'font-semibold text-[#101828]'}`}>
                        {i === 0 ? 'Mulai kembali' : i === points.length - 1 ? 'Posisi terakhir' : `Titik ${i}`}
                      </span>
                      <span className="text-[11px] text-[#667085]">{formatDateTime(p.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#667085]">
                      <span className="font-mono">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</span>
                      {p.speed != null && <span>{p.speed} km/h</span>}
                      {p.battery != null && <span>🔋 {p.battery}%</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-amber-600">Perjalanan kembali dimulai, menunggu titik GPS pertama…</p>
          )}
        </>
      )}
    </div>
  );
}