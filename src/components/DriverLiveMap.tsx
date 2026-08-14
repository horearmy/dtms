"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { addGoogleStyleTiles } from '@/lib/mapTiles';

type Props = {
  driverLat: number | null;
  driverLng: number | null;
  destLat: number | null;
  destLng: number | null;
  destination: string;
};

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

async function fetchRoute(coords: Array<[number, number]>): Promise<[number, number][]> {
  const q = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const res = await fetch(`${OSRM_URL}${q}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('osrm');
  const json = await res.json();
  const c: number[][] = json?.routes?.[0]?.geometry?.coordinates || [];
  if (!c.length) throw new Error('osrm empty');
  const points = c.map(([lng, lat]) => [lat, lng] as [number, number]);
  const MAX = 150;
  if (points.length <= MAX) return points;
  const step = Math.ceil(points.length / MAX);
  const sampled: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
  return sampled;
}

export default function DriverLiveMap({ driverLat, driverLng, destLat, destLng, destination }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeFallback, setRouteFallback] = useState(false);

  const driverPos =
    driverLat != null && driverLng != null ? { lat: driverLat, lng: driverLng } : null;
  const hasDest = destLat != null && destLng != null;

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true });
      addGoogleStyleTiles(map, L);
      map.attributionControl.setPrefix(false);
      leafletRef.current = map;
    })();
    return () => { cancelled = true; if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; } };
  }, []);

  useEffect(() => {
    setRoute(null);
    setRouteFallback(false);
    if (!driverPos || !hasDest) return;
    let cancelled = false;
    (async () => {
      const waypoints: Array<[number, number]> = [[driverPos.lat, driverPos.lng], [destLat!, destLng!]];
      try {
        const pts = await fetchRoute(waypoints);
        if (!cancelled) setRoute(pts);
      } catch {
        if (!cancelled) { setRoute(waypoints); setRouteFallback(true); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, destLat, destLng]);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      map.eachLayer((lyr) => { if (lyr instanceof L.Marker || lyr instanceof L.Polyline) map.removeLayer(lyr); });

      const bounds: Array<[number, number]> = [];

      if (driverPos) {
        const m = L.marker([driverPos.lat, driverPos.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:32px;height:32px;background:#2563eb;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:13px;">🚚</span></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 28],
          }),
        }).addTo(map);
        m.bindPopup('<div style="font-size:12px;"><b>Posisi Anda saat ini</b></div>');
        bounds.push([driverPos.lat, driverPos.lng]);
      }

      if (hasDest) {
        const m = L.marker([destLat!, destLng!], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:26px;height:26px;background:#dc2626;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:12px;">📍</span></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 24],
          }),
        }).addTo(map);
        m.bindPopup(`<div style="font-size:12px;min-width:150px;"><b>Tujuan</b><br/>${destination}</div>`);
        bounds.push([destLat!, destLng!]);
      }

      if (route && route.length > 1) {
        const line = L.polyline(route, {
          color: '#2563eb',
          weight: 3,
          opacity: 0.6,
          dashArray: routeFallback ? '4 6' : undefined,
        }).addTo(map);
        line.bindPopup(
          `<div style="font-size:12px;"><b>Rute pengiriman</b><br/>${route.length} titik${routeFallback ? '<br/><i style="color:#94a3b8;">Rute lurus (OSRM tidak merespons)</i>' : ''}</div>`
        );
      }

      if (bounds.length >= 2) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.setView([-6.21, 106.83], 11);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, driverPos, hasDest]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-sm font-bold text-slate-900">🗺️ Peta Lokasi Saya</h3>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Saya</span>
          {hasDest && <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> Tujuan</span>}
          {driverPos && <span className="font-mono">{driverPos.lat.toFixed(5)}, {driverPos.lng.toFixed(5)}</span>}
        </div>
      </div>
      <div className="h-64" ref={mapRef} />
      {!driverPos && (
        <div className="border-t border-slate-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Belum ada sinyal GPS. Aktifkan lokasi &amp; kirim posisi agar peta menampilkan lokasi Anda.
        </div>
      )}
    </div>
  );
}
