"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { CITY_COORDS } from '@/lib/constants';
import { addGoogleStyleTiles } from '@/lib/mapTiles';

type Point = { label: string; city: string | null; address: string | null; lat?: number | null; lng?: number | null };
type LatLng = { lat: number; lng: number };

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

function cityCoord(city: string | null): LatLng | null {
  if (!city) return null;
  return CITY_COORDS[city.toLowerCase().trim()] || null;
}

function resolveCoord(p: Point): LatLng | null {
  if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng };
  return cityCoord(p.city);
}

async function fetchRoute(o: LatLng, d: LatLng): Promise<{ points: [number, number][]; distanceKm: number; durationMin: number }> {
  const res = await fetch(`${OSRM_URL}${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('osrm');
  const json = await res.json();
  const route = json?.routes?.[0];
  const coords: number[][] = route?.geometry?.coordinates || [];
  if (!coords.length) throw new Error('osrm empty');
  const points = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
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

export default function RoutePreviewMap({ origin, dest }: { origin: Point | null; dest: Point | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const [status, setStatus] = useState('Pilih pengirim & penerima untuk melihat rute di peta.');
  const [info, setInfo] = useState<string | null>(null);

  const o = origin ? resolveCoord(origin) : null;
  const d = dest ? resolveCoord(dest) : null;

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

      if (!origin || !dest) {
        setStatus('Pilih pengirim & penerima untuk melihat rute di peta.');
        return;
      }
      if (!o || !d) {
        setStatus('Koordinat kota pengirim/penerima belum tersedia di database kota.');
        return;
      }

      const green = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;background:#059669;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:11px;">🏭</span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const red = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;background:#dc2626;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:11px;">📍</span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });

      L.marker([o.lat, o.lng], { icon: green }).addTo(markerLayer.current!).bindPopup(`<div style="font-size:12px;"><b>Pengirim</b><br/>${origin.label}</div>`);
      L.marker([d.lat, d.lng], { icon: red }).addTo(markerLayer.current!).bindPopup(`<div style="font-size:12px;"><b>Penerima</b><br/>${dest.label}</div>`);

      try {
        const route = await fetchRoute(o, d);
        if (cancelled) return;
        const line = L.polyline(route.points, { color: '#2563eb', weight: 3, opacity: 0.65 }).addTo(routeLayer.current!);
        line.bindPopup(`<div style="font-size:12px;">Rute pengiriman · ${route.distanceKm} km · ±${route.durationMin} mnt</div>`);
        setStatus(`Rute ${origin.label.split(',')[0]} → ${dest.label.split(',')[0]} ditampilkan.`);
        setInfo(`${route.distanceKm} km · ±${Math.floor(route.durationMin / 60)} jam ${route.durationMin % 60} mnt`);
        map.fitBounds(L.latLngBounds([o.lat, o.lng], [d.lat, d.lng]).pad(0.2));
      } catch {
        if (cancelled) return;
        L.polyline([[o.lat, o.lng], [d.lat, d.lng]], { color: '#2563eb', weight: 3, opacity: 0.6, dashArray: '4 6' }).addTo(routeLayer.current!);
        setStatus('Rute lurus (layanan routing tidak merespons).');
        map.fitBounds(L.latLngBounds([o.lat, o.lng], [d.lat, d.lng]).pad(0.2));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, dest]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.5-2.5V5L9 7.5 15 5l5.5 2.5V18L15 15.5 9 18zM9 7.5V18M15 5v12.5" /></svg>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Peta Rute Pengiriman</span>
        </div>
        {info ? (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">{info}</span>
        ) : (
          <span className="text-[11px] text-slate-400">{status}</span>
        )}
      </div>
      <div ref={mapRef} className="h-96 w-full" />
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-emerald-500" /> Pengirim
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500" /> Penerima
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded bg-blue-500" /> Rute
        </span>
        {status && info && <span className="ml-auto text-[11px] text-slate-400">{status}</span>}
      </div>
    </div>
  );
}