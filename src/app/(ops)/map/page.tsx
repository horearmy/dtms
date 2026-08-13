"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import StatusBadge from '@/components/StatusBadge';

type DriverPos = {
  driverId: string; name: string; vehicleNumber: string | null;
  latitude: number; longitude: number; speed: number | null; battery: number | null; updatedAt: string;
};
type ShipPos = {
  id: string; trackingNumber: string; status: string; destination: string; origin: string;
  driver: string | null; vehicle: string | null;
  originLat: number | null; originLng: number | null; destLat: number | null; destLng: number | null;
};
type Geofence = {
  id: string; name: string; latitude: number; longitude: number; radiusMeters: number; type: string; active: boolean;
};
type RouteLine = { id: string; trackingNumber: string; points: [number, number][]; status: string };

function statusColor(status: string) {
  if (status === 'DELIVERED') return '#059669';
  if (status === 'DELIVERY_FAILED' || status === 'RETURNED' || status === 'RETURN_TO_SENDER') return '#dc2626';
  if (status === 'OUT_FOR_DELIVERY') return '#d97706';
  if (status === 'IN_TRANSIT' || status === 'DISPATCHED') return '#2563eb';
  if (status === 'ARRIVED_AT_HUB') return '#7c3aed';
  return '#94a3b8';
}

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';

async function fetchRoute(originLat: number, originLng: number, destLat: number, destLng: number): Promise<[number, number][]> {
  const res = await fetch(`${OSRM_URL}${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`);
  if (!res.ok) throw new Error('osrm');
  const json = await res.json();
  const coords: number[][] = json?.routes?.[0]?.geometry?.coordinates || [];
  if (!coords.length) throw new Error('osrm empty');
  const points = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
  const MAX = 150;
  if (points.length <= MAX) return points;
  const step = Math.ceil(points.length / MAX);
  const sampled: [number, number][] = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
  return sampled;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const driverLayer = useRef<L.LayerGroup | null>(null);
  const shipLayer = useRef<L.LayerGroup | null>(null);
  const geofenceLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const [drivers, setDrivers] = useState<DriverPos[]>([]);
  const [ships, setShips] = useState<ShipPos[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [routes, setRoutes] = useState<RouteLine[]>([]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [routeLoaded, setRouteLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [center] = useState<[number, number]>([-6.21, 106.83]);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current).setView(center, 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      driverLayer.current = L.layerGroup().addTo(map);
      shipLayer.current = L.layerGroup().addTo(map);
      geofenceLayer.current = L.layerGroup().addTo(map);
      routeLayer.current = L.layerGroup().addTo(map);
      leafletRef.current = map;
    })();
    return () => { cancelled = true; if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      const res = await fetch('/api/gps/latest?minutes=120');
      if (res.ok) {
        const data = await res.json();
        if (!active) return;
        setDrivers(data.drivers || []);
        setShips(data.shipments || []);
        setLastUpdate(new Date().toLocaleTimeString('id-ID'));
      }
    }
    async function fetchGeofences() {
      const res = await fetch('/api/geofences');
      if (res.ok) {
        const data = await res.json();
        if (active) setGeofences(data || []);
      }
    }
    fetchData();
    fetchGeofences();
    const t = setInterval(fetchData, 15000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // ambil rute dari OSRM untuk setiap shipment
  useEffect(() => {
    let active = true;
    const routable = ships.filter((s) => s.originLat != null && s.originLng != null && s.destLat != null && s.destLng != null);
    if (routable.length === 0) {
      setRoutes([]);
      setRouteLoaded(false);
      return;
    }
    (async () => {
      const result: RouteLine[] = [];
      await Promise.all(
        routable.map(async (s) => {
          try {
            const points = await fetchRoute(s.originLat!, s.originLng!, s.destLat!, s.destLng!);
            if (active) result.push({ id: s.id, trackingNumber: s.trackingNumber, points, status: s.status });
          } catch {
            if (active) result.push({ id: s.id, trackingNumber: s.trackingNumber, points: [[s.originLat!, s.originLng!], [s.destLat!, s.destLng!]], status: s.status });
          }
        })
      );
      if (!active) return;
      setRoutes(result);
      setRouteLoaded(true);
    })();
    return () => { active = false; };
  }, [ships]);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      geofenceLayer.current?.clearLayers();
      geofences.filter((g) => g.active).forEach((g) => {
        const circle = L.circle([g.latitude, g.longitude], {
          radius: g.radiusMeters,
          color: '#7c3aed',
          weight: 1.5,
          dashArray: '6 4',
          fillColor: '#7c3aed',
          fillOpacity: 0.06,
        }).addTo(geofenceLayer.current!);
        circle.bindPopup(`<div style="font-size:12px;"><b>${g.name}</b><br/>${g.type} · radius ${g.radiusMeters} m</div>`);
      });
    })();
    return () => { cancelled = true; };
  }, [geofences]);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      driverLayer.current?.clearLayers();
      shipLayer.current?.clearLayers();

      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:#2563eb;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:14px;">🚚</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 30],
      });

      drivers.forEach((d) => {
        const m = L.marker([d.latitude, d.longitude], { icon: driverIcon }).addTo(driverLayer.current!);
        m.bindPopup(
          `<div style="font-size:12px;min-width:170px;">
             <b style="font-size:13px;">${d.name}</b><br/>
             Kendaraan: ${d.vehicleNumber || '-'}<br/>
             Kecepatan: ${d.speed != null ? d.speed + ' km/h' : '-'}<br/>
             Baterai: ${d.battery != null ? d.battery + '%' : '-'}<br/>
             Update: ${new Date(d.updatedAt).toLocaleTimeString('id-ID')}
           </div>`
        );
      });

      ships.forEach((s) => {
        if (s.destLat == null || s.destLng == null) return;
        const color = statusColor(s.status);
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:22px;height:22px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,.3);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const m = L.marker([s.destLat, s.destLng], { icon }).addTo(shipLayer.current!);
        m.bindPopup(
          `<div style="font-size:12px;min-width:180px;">
             <b style="font-family:monospace;">${s.trackingNumber}</b><br/>
             Status: ${s.status}<br/>
             Asal: ${s.origin}<br/>
             Tujuan: ${s.destination}<br/>
             Driver: ${s.driver || '-'}<br/>
             <a href="/shipments/${s.id}" style="color:#1d4ed8;">Lihat detail →</a>
           </div>`
        );
      });
    })();
    return () => { cancelled = true; };
  }, [drivers, ships]);

  // draw route polylines
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      routeLayer.current?.clearLayers();
      if (!showRoutes) return;
      routes.forEach((r) => {
        const color = statusColor(r.status);
        const line = L.polyline(r.points, {
          color,
          weight: 3,
          opacity: 0.6,
          dashArray: routeFallback(r) ? '4 6' : undefined,
        }).addTo(routeLayer.current!);
        line.bindPopup(
          `<div style="font-size:12px;min-width:160px;">
             <b style="font-family:monospace;">${r.trackingNumber}</b><br/>
             Rute pengiriman · ${r.points.length} titik
             ${routeFallback(r) ? '<br/><i style="color:#94a3b8;">Rute lurus (OSRM tidak merespons)</i>' : ''}
           </div>`
        );
        if (r.points.length > 1) {
          const [aLat, aLng] = r.points[0];
          L.circleMarker([aLat, aLng], { radius: 4, color: '#fff', weight: 2, fillColor: '#059669', fillOpacity: 1 }).addTo(routeLayer.current!);
          const [bLat, bLng] = r.points[r.points.length - 1];
          L.circleMarker([bLat, bLng], { radius: 4, color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }).addTo(routeLayer.current!);
        }
      });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, showRoutes]);

  const routeFallback = (r: RouteLine) => r.points.length === 2;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Tracking Map</h1>
          <p className="text-sm text-slate-500">
            Posisi driver & shipment · Update otomatis tiap 15 detik{lastUpdate && ` · Terakhir: ${lastUpdate}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-brand-600" /> Driver</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-600" /> Shipment</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-violet-500" /> Geofence</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-5 rounded bg-emerald-500" /> Rute</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Tampilkan Rute
          </label>
          {routeLoaded && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {routes.length} rute {routes.some(routeFallback) ? '(beberapa fallback garis lurus)' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div ref={mapRef} className="h-full w-full" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Driver Aktif ({drivers.length})</h2>
          <div className="space-y-3">
            {drivers.map((d) => (
              <div key={d.driverId} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{d.name}</span>
                  <span className="text-xs text-slate-400">{d.speed != null ? `${d.speed} km/h` : '-'}</span>
                </div>
                <div className="text-xs text-slate-500">{d.vehicleNumber || '-'} · Update {new Date(d.updatedAt).toLocaleTimeString('id-ID')}</div>
              </div>
            ))}
            {drivers.length === 0 && <p className="text-sm text-slate-400">Belum ada data GPS 2 jam terakhir</p>}
          </div>
          <h2 className="mb-3 mt-5 text-sm font-bold text-slate-900">Shipment Aktif ({ships.length})</h2>
          <div className="space-y-3">
            {ships.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-100 p-3">
                <div className="font-mono text-xs font-semibold text-brand-600">{s.trackingNumber}</div>
                <div className="mt-1"><StatusBadge status={s.status} /></div>
                <div className="mt-1 text-xs text-slate-500">{s.origin} → {s.destination}</div>
                {s.originLat != null && s.destLat != null && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="h-1.5 w-4 rounded" style={{ background: statusColor(s.status) }} />
                    Rute tersedia
                  </div>
                )}
              </div>
            ))}
            {ships.length === 0 && <p className="text-sm text-slate-400">Tidak ada shipment aktif</p>}
          </div>
          <h2 className="mb-3 mt-5 text-sm font-bold text-slate-900">Geofence Aktif ({geofences.filter((g) => g.active).length})</h2>
          <div className="space-y-2">
            {geofences.filter((g) => g.active).map((g) => (
              <div key={g.id} className="rounded-lg border border-slate-100 p-3">
                <div className="text-sm font-semibold text-slate-800">{g.name}</div>
                <div className="text-xs text-slate-500">{g.type} · radius {g.radiusMeters} m</div>
              </div>
            ))}
            {geofences.length === 0 && <p className="text-sm text-slate-400">Tidak ada geofence</p>}
          </div>
        </div>
      </div>
    </div>
  );
}