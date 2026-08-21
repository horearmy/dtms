'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type HeatPoint = { lat: number; lng: number; intensity: number; tenantId: string };

function HeatmapLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!map || readyRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).L = L;
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    try { require('leaflet.heat'); } catch {}
    readyRef.current = true;
  }, [map]);

  useEffect(() => {
    if (!map || !readyRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LMod = (window as any).L as typeof L & { heatLayer?: (...args: unknown[]) => L.Layer };
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    const heatData: [number, number, number][] = points.map((p) => [p.lat, p.lng, p.intensity]);
    if (!LMod.heatLayer) return;
    const heat = LMod.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.2: '#2563eb',
        0.4: '#3b82f6',
        0.6: '#f59e0b',
        0.8: '#ef4444',
        1.0: '#dc2626',
      },
    }).addTo(map);
    layerRef.current = heat;
    return () => {
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

export default function GlobalMap({ center, points }: { center: [number, number]; points: HeatPoint[] }) {
  return (
    <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={true}>
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution="&copy; Google"
      />
      <HeatmapLayer points={points} />
    </MapContainer>
  );
}
