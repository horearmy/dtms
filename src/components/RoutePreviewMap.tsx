"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { CITY_COORDS } from '@/lib/constants';
import { addGoogleStyleTiles } from '@/lib/mapTiles';

export type RoutePoint = { label: string; city: string | null; address: string | null; lat?: number | null; lng?: number | null };
type LatLng = { lat: number; lng: number };

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

function cityCoord(city: string | null): LatLng | null {
  if (!city) return null;
  return CITY_COORDS[city.toLowerCase().trim()] || null;
}

function resolveCoord(p: RoutePoint): LatLng | null {
  if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng };
  return cityCoord(p.city);
}

async function fetchRoute(coords: LatLng[]): Promise<{ points: [number, number][]; distanceKm: number; durationMin: number }> {
  const q = coords.map((c) => `${c.lng},${c.lat}`).join(';');
  const res = await fetch(`${OSRM_URL}${q}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('osrm');
  const json = await res.json();
  const route = json?.routes?.[0];
  const rc: number[][] = route?.geometry?.coordinates || [];
  if (!rc.length) throw new Error('osrm empty');
  const points = rc.map(([lng, lat]) => [lat, lng] as [number, number]);
  const MAX = 150;
  const sampled = points.length <= MAX ? points : (() => {
    const step = Math.ceil(points.length / MAX);
    const out: [number, number][] = [];
    for (let i = 0; i < points.length; i += step) out.push(points[i]);
    if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
    return out;
  })();
  return { points: sampled, distanceKm: Math.round((route.distance || 0) / 1000), durationMin: Math.round((route.duration || 0) / 60) };
}

export type RouteInfo = { distanceKm: number; durationMin: number };

export default function RoutePreviewMap({ stops, onRouteInfo }: { stops: Array<RoutePoint | null>; onRouteInfo?: (info: RouteInfo | null) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const [status, setStatus] = useState('Pilih pengirim & tujuan untuk melihat rute di peta.');
  const [info, setInfo] = useState<string | null>(null);

  // koordinat ter-resolve per stop (nilai null = belum tersedia)
  const resolved = stops.map((p) => (p ? resolveCoord(p) : null));
  const senderCoord = resolved[0] || null;
  const destCoords = resolved.slice(1).filter((c): c is LatLng => c != null);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current).setView([-6.21, 106.83], 11);
      addGoogleStyleTiles(map, L);
      markerLayer.current = L.layerGroup().addTo(map);
      routeLayer.current = L.layerGroup().addTo(map);
      mapInst.current = map;
    })();
    return () => { cancelled = true; if (mapInst.current) { mapInst.current.remove(); mapInst.current = null; } };
  }, []);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      markerLayer.current?.clearLayers();
      routeLayer.current?.clearLayers();
      setInfo(null);

      const points = resolved.filter((c): c is LatLng => c != null);
      if (!stops[0] || stops.length < 2) {
        setStatus('Lengkapi pengirim & minimal satu tujuan untuk melihat rute di peta.');
        onRouteInfo?.(null);
        return;
      }
      if (points.length < 2) {
        setStatus('Koordinat belum tersedia. Tetapkan lokasi pengirim/tujuan pada peta customer.');
        onRouteInfo?.(null);
        return;
      }

      // placeholder icon: pengirim (hijau) & tujuan bernomor (merah)
      const green = (n: string, cls: string, color: string) =>
        L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:${color};border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:11px;${cls}">${n}</span></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });

      // marker per stop yang ter-resolve
      resolved.forEach((c, i) => {
        if (!c || !stops[i]) return;
        const isSender = i === 0;
        const icon = green(isSender ? '🏭' : String(i), isSender ? '' : 'font-weight:700;color:#fff;', isSender ? '#16B364' : '#F5222D');
        L.marker([c.lat, c.lng], { icon }).addTo(markerLayer.current!).bindPopup(
          `<div style="font-size:12px;"><b>${isSender ? 'Pengirim' : `Tujuan ${i}`}</b><br/>${stops[i]!.label}</div>`
        );
      });

      try {
        const route = await fetchRoute(points);
        if (cancelled) return;
        const line = L.polyline(route.points, { color: '#0D6EFD', weight: 3, opacity: 0.65 }).addTo(routeLayer.current!);
        line.bindPopup(`<div style="font-size:12px;">Rute pengiriman (${points.length} titik) · ${route.distanceKm} km · ±${route.durationMin} mnt</div>`);
        const firstLabel = stops[0]!.label.split(',')[0];
        let lastIdx = -1;
        for (let i = resolved.length - 1; i > 0; i--) {
          if (resolved[i] != null) { lastIdx = i; break; }
        }
        const lastLabel = lastIdx >= 0 && stops[lastIdx] ? stops[lastIdx]!.label.split(',')[0] : '';
        setStatus(`Rute ${firstLabel}${destCoords.length > 1 ? ` +${stops.length - 2} tujuan` : ''} → ${lastLabel} ditampilkan.`);
        setInfo(`${route.distanceKm} km · ±${Math.floor(route.durationMin / 60)} jam ${route.durationMin % 60} mnt`);
        onRouteInfo?.({ distanceKm: route.distanceKm, durationMin: route.durationMin });
        map.fitBounds(L.latLngBounds(points).pad(0.2));
      } catch {
        if (cancelled) return;
        L.polyline(points, { color: '#0D6EFD', weight: 3, opacity: 0.6, dashArray: '4 6' }).addTo(routeLayer.current!);
        setStatus('Rute lurus (layanan routing tidak merespons).');
        onRouteInfo?.(null);
        map.fitBounds(L.latLngBounds(points).pad(0.2));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#F7F9FC] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#0D6EFD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.5-2.5V5L9 7.5 15 5l5.5 2.5V18L15 15.5 9 18zM9 7.5V18M15 5v12.5" /></svg>
          <span className="text-xs font-bold uppercase tracking-wide text-[#667085]">Peta Rute Pengiriman</span>
        </div>
        {info ? (
          <span className="rounded-full bg-[#E7F0FF] px-2.5 py-0.5 text-[11px] font-bold text-[#0D6EFD]">{info}</span>
        ) : (
          <span className="text-[11px] text-[#667085]">{status}</span>
        )}
      </div>
      <div ref={mapRef} className="h-96 w-full" />
      <div className="flex flex-wrap items-center gap-4 border-t border-[#F7F9FC] px-4 py-2 text-[11px] text-[#667085]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#16B364]" /> Pengirim
        </span>
        {stops.slice(1).map((_, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#F5222D] text-[8px] font-bold text-white">{i + 1}</span> Tujuan {i + 1}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded bg-[#0D6EFD]" /> Rute
        </span>
        {status && info && <span className="ml-auto text-[11px] text-[#667085]">{status}</span>}
      </div>
    </div>
  );
}