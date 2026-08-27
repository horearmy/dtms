'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type DriverPoint = { lat: number; lng: number; intensity: number; tenantId: string; driverId: string; driverName: string; tenantName: string };

function HeatmapLayer({ points }: { points: DriverPoint[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!map || readyRef.current) return;
     
    (window as any).L = L;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    try { require('leaflet.heat'); } catch {}
    readyRef.current = true;
  }, [map]);

  useEffect(() => {
    if (!map || !readyRef.current) return;
     
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

function SelectedDriverMarker({ driver }: { driver: DriverPoint | null }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const lastFlyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;

    // Kamera terbang ke lokasi hanya saat pemilihan driver berganti,
    // bukan setiap kali koordinat diperbarui (agar user bebas menggeser peta).
    if (!driver) {
      lastFlyRef.current = null;
    } else if (lastFlyRef.current !== driver.driverId) {
      map.flyTo([driver.lat, driver.lng], 14, { duration: 1 });
      lastFlyRef.current = driver.driverId;
    }

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (!driver) return;

    const pulseIcon = L.divIcon({
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      html: `<div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(14,165,233,0.3);animation:pulse-ring 1.5s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#0ea5e9;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>
      </div>`,
    });

    const marker = L.marker([driver.lat, driver.lng], { icon: pulseIcon })
      .addTo(map)
      .bindPopup(`<b>${driver.driverName}</b><br/>${driver.tenantName}`);
    markerRef.current = marker;

    return () => {
      if (markerRef.current && map) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [map, driver]);

  return null;
}

export default function GlobalMap({ center, points, selectedDriver }: { center: [number, number]; points: DriverPoint[]; selectedDriver?: DriverPoint | null }) {
  return (
    <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={true}>
      <TileLayer
        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        attribution="&copy; Google"
      />
      <HeatmapLayer points={points} />
      <SelectedDriverMarker driver={selectedDriver ?? null} />
    </MapContainer>
  );
}
