"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { addGoogleStyleTiles } from '@/lib/mapTiles';
import { formatDateTime } from '@/lib/constants';

type GpsPoint = { latitude: number; longitude: number; speed?: number | null; battery?: number | null; createdAt: string };
type DriverWithGps = {
  id: string; name: string; photo?: string | null; vehicleNumber?: string | null;
  gpsLogs?: GpsPoint[];
};

type Props = {
  trackingNumber: string;
  origin: string;
  destination: string;
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  driver: DriverWithGps | null;
  status: string;
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

export default function ShipmentLiveMap({ trackingNumber, origin, destination, originLat, originLng, destLat, destLng, driver, status }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeFallback, setRouteFallback] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const gps = driver?.gpsLogs?.[0];
  const driverPos: { lat: number; lng: number } | null =
    gps && gps.latitude != null && gps.longitude != null ? { lat: gps.latitude, lng: gps.longitude } : null;

  // init map sekali
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

  // hitung rute OSRM
  useEffect(() => {
    setRoute(null);
    setRouteFallback(false);
    setLoadingRoute(true);
    let cancelled = false;
    const hasAll =
      originLat != null && originLng != null && destLat != null && destLng != null;
    if (!hasAll) {
      setLoadingRoute(false);
      return;
    }
    (async () => {
      const waypoints: Array<[number, number]> = [[originLat!, originLng!], [destLat!, destLng!]];
      try {
        const pts = await fetchRoute(waypoints);
        if (!cancelled) { setRoute(pts); setRouteFallback(false); }
      } catch {
        if (!cancelled) { setRoute(waypoints); setRouteFallback(true); }
      }
      if (!cancelled) setLoadingRoute(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originLat, originLng, destLat, destLng]);

  // render marker + rute + fit bounds
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      map.eachLayer((lyr) => { if (lyr instanceof L.Marker || lyr instanceof L.Polyline || lyr instanceof L.CircleMarker) map.removeLayer(lyr); });

      const bounds: Array<[number, number]> = [];
      const hasOrDest = originLat != null && originLng != null && destLat != null && destLng != null;

      if (originLat != null && originLng != null) {
        const m = L.marker([originLat, originLng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:26px;height:26px;background:#059669;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:13px;">🏭</span></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 24],
          }),
        }).addTo(map);
        m.bindPopup(`<div style="font-size:12px;min-width:150px;"><b>Asal</b><br/>${origin}</div>`);
        bounds.push([originLat, originLng]);
      }

      if (destLat != null && destLng != null) {
        const m = L.marker([destLat, destLng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:26px;height:26px;background:#dc2626;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:13px;">📍</span></div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 24],
          }),
        }).addTo(map);
        m.bindPopup(`<div style="font-size:12px;min-width:150px;"><b>Tujuan</b><br/>${destination}</div>`);
        bounds.push([destLat, destLng]);
      }

      if (driverPos) {
        const m = L.marker([driverPos.lat, driverPos.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:34px;height:34px;background:#2563eb;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:14px;">🚚</span></div>`,
            iconSize: [34, 34],
            iconAnchor: [17, 30],
          }),
        }).addTo(map);
        m.bindPopup(
          `<div style="font-size:12px;min-width:170px;">
             <b>${driver?.name || 'Driver'}</b> — Posisi saat ini<br/>
             ${driver?.vehicleNumber ? `Kendaraan: ${driver.vehicleNumber}<br/>` : ''}
             ${gps?.speed != null ? `Kecepatan: ${gps.speed} km/h<br/>` : ''}
             ${gps?.battery != null ? `Baterai: ${gps.battery}%<br/>` : ''}
             Update: ${gps?.createdAt ? formatDateTime(gps.createdAt) : '-'}
           </div>`
        );
        bounds.push([driverPos.lat, driverPos.lng]);
      }

      if (route && route.length > 1) {
        const line = L.polyline(route, {
          color: status === 'DELIVERED' || status === 'RETURNED' ? '#059669' : '#2563eb',
          weight: 3,
          opacity: 0.6,
          dashArray: routeFallback ? '4 6' : undefined,
        }).addTo(map);
        line.bindPopup(
          `<div style="font-size:12px;min-width:150px;">
             <b style="font-family:monospace;">${trackingNumber}</b><br/>
             Rute pengiriman · ${route.length} titik
             ${routeFallback ? '<br/><i style="color:#94a3b8;">Rute lurus (OSRM tidak merespons)</i>' : ''}
           </div>`
        );
        if (hasOrDest && bounds.length < 2) {
          bounds.push([route[0][0], route[0][1]], [route[route.length - 1][0], route[route.length - 1][1]]);
        }
      }

      if (bounds.length >= 2) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else {
        map.setView([-6.21, 106.83], 11);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, driverPos, originLat, originLng, destLat, destLng]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-bold text-slate-900">Lokasi Paket Saat Ini</h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          {driverPos ? (
            <>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Driver</span>
              <span className="font-mono">{driverPos.lat.toFixed(5)}, {driverPos.lng.toFixed(5)}</span>
            </>
          ) : (
            <span>Belum ada sinyal GPS driver</span>
          )}
          {loadingRoute && <span className="text-slate-400">menghitung rute…</span>}
        </div>
      </div>
      <div className="h-80 md:h-96" ref={mapRef} />
      {(!originLat || !destLat) && (
        <div className="border-t border-slate-100 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Asal/tujuan tanpa koordinat — peta hanya menampilkan posisi driver saat ini.
        </div>
      )}
    </div>
  );
}