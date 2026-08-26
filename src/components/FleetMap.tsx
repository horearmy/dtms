"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { addGoogleStyleTiles } from '@/lib/mapTiles';
import { formatDateTime, STATUS_LABELS } from '@/lib/constants';

type GpsPos = {
  shipmentId: string;
  trackingNumber: string;
  status: string;
  origin: string;
  destination: string;
  tenantId: string | null;
  driver: { id: string; name: string; employeeId: string };
  vehicle: { id: string; vehicleNumber: string } | null;
  gps: { latitude: number; longitude: number; speed: number | null; battery: number | null; createdAt: string };
};

const STATUS_COLOR: Record<string, string> = {
  IN_TRANSIT: '#0D6EFD',
  DISPATCHED: '#FF8A00',
  OUT_FOR_DELIVERY: '#7C3AED',
  WAREHOUSE_RECEIVED: '#16B364',
  ARRIVED_AT_HUB: '#16B364',
  ORDER_CREATED: '#667085',
  RESCHEDULED: '#F5222D',
};

function truckIcon(color: string) {
  return `div-icon`;
}

export default function FleetMap({ positions, onSelect }: { positions: GpsPos[]; onSelect?: (p: GpsPos) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [, setTick] = useState(0);

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
    return () => {
      cancelled = true;
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, []);

  const renderMarkers = useCallback(async () => {
    const map = leafletRef.current;
    if (!map) return;
    const L = (await import('leaflet')).default;

    const prevIds = new Set(markersRef.current.keys());
    const newIds = new Set(positions.map((p) => p.driver.id));

    prevIds.forEach((id) => {
      if (!newIds.has(id)) {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    });

    const bounds: [number, number][] = [];

    for (const p of positions) {
      const { latitude: lat, longitude: lng } = p.gps;
      if (lat == null || lng == null) continue;

      const color = STATUS_COLOR[p.status] || '#667085';
      const html = `<div style="position:relative;width:30px;height:30px;">
        <div style="width:30px;height:30px;background:${color};border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.35);">
          <span style="transform:rotate(45deg);font-size:14px;">🚚</span>
        </div>
        ${p.gps.speed != null && p.gps.speed > 0 ? `<div style="position:absolute;top:-6px;right:-6px;background:#16B364;color:white;font-size:8px;font-weight:700;border-radius:6px;padding:1px 3px;white-space:nowrap;">${Math.round(p.gps.speed)}</div>` : ''}
      </div>`;

      const existing = markersRef.current.get(p.driver.id);
      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.setIcon(L.divIcon({
          className: '',
          html,
          iconSize: [30, 30],
          iconAnchor: [15, 26],
        }));
      } else {
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({ className: '', html, iconSize: [30, 30], iconAnchor: [15, 26] }),
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-size:12px;min-width:180px;font-family:system-ui;">
            <div style="font-weight:700;margin-bottom:4px;">${p.driver.name}</div>
            <div style="color:#667085;">ID: ${p.driver.employeeId}</div>
            ${p.vehicle ? `<div style="color:#667085;">Plat: ${p.vehicle.vehicleNumber}</div>` : ''}
            <hr style="margin:4px 0;border:none;border-top:1px solid #E4E7EC;"/>
            <div><b style="font-family:monospace;color:#0D6EFD;">${p.trackingNumber}</b></div>
            <div style="color:#667085;font-size:11px;">${p.origin} → ${p.destination}</div>
            <div style="margin-top:2px;"><span style="display:inline-block;padding:1px 6px;border-radius:4px;background:${color}22;color:${color};font-size:10px;font-weight:600;">${STATUS_LABELS[p.status] || p.status}</span></div>
            ${p.gps.speed != null ? `<div style="margin-top:3px;color:#667085;">⚡ ${Math.round(p.gps.speed)} km/h</div>` : ''}
            ${p.gps.battery != null ? `<div style="color:#667085;">🔋 ${p.gps.battery}%</div>` : ''}
            <div style="margin-top:3px;color:#667085;font-size:10px;">📍 ${formatDateTime(p.gps.createdAt)}</div>
          </div>
        `, { maxWidth: 260 });

        if (onSelect) {
          marker.on('click', () => onSelect(p));
        }

        markersRef.current.set(p.driver.id, marker);
      }

      bounds.push([lat, lng]);
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 14 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    }
  }, [positions, onSelect]);

  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-[#F7F9FC] px-4 py-2.5">
        <h2 className="text-sm font-bold text-[#101828]">🗺 Peta Armada Live</h2>
        <div className="flex items-center gap-3 text-[11px] text-[#667085]">
          <span>{positions.length} driver aktif</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#0D6EFD]" />In Transit</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FF8A00]" />Dispatched</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7C3AED]" />Out for Delivery</span>
        </div>
      </div>
      <div className="h-80 md:h-[480px]" ref={mapRef} />
    </div>
  );
}
