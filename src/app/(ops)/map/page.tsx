"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import StatusBadge from '@/components/StatusBadge';
import { addGoogleStyleTiles } from '@/lib/mapTiles';

type DriverPos = {
  driverId: string; name: string; photo: string | null; vehicleNumber: string | null;
  latitude: number; longitude: number; speed: number | null; battery: number | null; updatedAt: string;
  returning: boolean; returnedAt: string | null;
  warehouseName: string | null; warehouseLat: number | null; warehouseLng: number | null;
};
type ShipPos = {
  id: string; trackingNumber: string; status: string; destination: string; origin: string;
  driver: string | null; vehicle: string | null;
  originLat: number | null; originLng: number | null; destLat: number | null; destLng: number | null;
  stops?: { seq: number; label: string; latitude: number; longitude: number }[];
};
type Geofence = {
  id: string; name: string; latitude: number; longitude: number; radiusMeters: number; type: string; active: boolean;
};
type RouteLine = { id: string; trackingNumber: string; points: [number, number][]; status: string };
type ReturnRoute = { id: string; name: string; points: [number, number][] };

function statusColor(status: string) {
  if (status === 'DELIVERED') return '#059669';
  if (status === 'DELIVERY_FAILED' || status === 'RETURNED' || status === 'RETURN_TO_SENDER') return '#dc2626';
  if (status === 'OUT_FOR_DELIVERY') return '#d97706';
  if (status === 'IN_TRANSIT' || status === 'DISPATCHED') return '#2563eb';
  if (status === 'ARRIVED_AT_HUB') return '#7c3aed';
  return '#94a3b8';
}

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

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const driverLayer = useRef<L.LayerGroup | null>(null);
  const shipLayer = useRef<L.LayerGroup | null>(null);
  const geofenceLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const shipMarkers = useRef<Map<string, L.Marker>>(new Map());
  const [drivers, setDrivers] = useState<DriverPos[]>([]);
  const [ships, setShips] = useState<ShipPos[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [routes, setRoutes] = useState<RouteLine[]>([]);
  const [returnRoutes, setReturnRoutes] = useState<ReturnRoute[]>([]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [routeLoaded, setRouteLoaded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [center] = useState<[number, number]>([-6.21, 106.83]);

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current).setView(center, 12);
      addGoogleStyleTiles(map, L);
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
          const waypoints: Array<[number, number]> =
            s.stops && s.stops.length >= 3
              ? s.stops.map((st) => [st.latitude, st.longitude])
              : [[s.originLat!, s.originLng!], [s.destLat!, s.destLng!]];
          try {
            const points = await fetchRoute(waypoints);
            if (active) result.push({ id: s.id, trackingNumber: s.trackingNumber, points, status: s.status });
          } catch {
            if (active) result.push({ id: s.id, trackingNumber: s.trackingNumber, points: waypoints, status: s.status });
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
    let active = true;
    const returning = drivers.filter(
      (d) => d.returning && d.warehouseLat != null && d.warehouseLng != null
    );
    if (returning.length === 0) {
      setReturnRoutes([]);
      return;
    }
    (async () => {
      const result: ReturnRoute[] = [];
      await Promise.all(
        returning.map(async (d) => {
          const from: [number, number] = [d.latitude, d.longitude];
          const to: [number, number] = [d.warehouseLat!, d.warehouseLng!];
          try {
            const points = await fetchRoute([from, to]);
            if (active) result.push({ id: d.driverId, name: d.name, points });
          } catch {
            if (active) result.push({ id: d.driverId, name: d.name, points: [from, to] });
          }
        })
      );
      if (!active) return;
      setReturnRoutes(result);
    })();
    return () => { active = false; };
  }, [drivers]);

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
      shipMarkers.current.clear();

      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:#2563eb;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:14px;">🚚</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 30],
      });
      const driverReturnIcon = L.divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;background:#facc15;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:14px;">🚚</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 30],
      });

      drivers.forEach((d) => {
        const m = L.marker([d.latitude, d.longitude], { icon: d.returning ? driverReturnIcon : driverIcon }).addTo(driverLayer.current!);
        m.bindTooltip(
          `<div style="display:flex;align-items:center;gap:8px;font-size:12px;min-width:150px;">
             ${d.photo ? `<img src="${d.photo}" alt="${d.name}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #facc15;"/><div><b>${d.name}</b>` : `<div><b>${d.name}</b>`}
             <br/><span style="color:#64748b;">${d.vehicleNumber || '-'}${d.returning ? ' · 🚚 kembali' : ''}</span></div>
           </div>`,
          { sticky: true, direction: 'top', opacity: 0.95 }
        );
        m.bindPopup(
          `<div style="font-size:12px;min-width:180px;">
             ${d.photo ? `<div style="text-align:center;margin-bottom:6px;"><img src="${d.photo}" alt="${d.name}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;"/></div>` : ''}
             <b style="font-size:13px;">${d.name}</b><br/>
             ${d.returning ? '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:0 6px;border-radius:9999px;font-weight:700;">🚚 Kembali ke Gudang</span><br/>' : ''}
             Kendaraan: ${d.vehicleNumber || '-'}<br/>
             Kecepatan: ${d.speed != null ? d.speed + ' km/h' : '-'}<br/>
             Baterai: ${d.battery != null ? d.battery + '%' : '-'}<br/>
             Gudang asal: ${d.warehouseName || '-'}<br/>
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
        shipMarkers.current.set(s.id, m);
        m.bindPopup(
          `<div style="font-size:12px;min-width:180px;">
             <b style="font-family:monospace;">${s.trackingNumber}</b><br/>
             Status: ${s.status}<br/>
             Asal: ${s.origin}<br/>
             Tujuan: ${s.destination}<br/>
             Driver: ${s.driver || '-'}<br/>
             <a href="/shipments/${s.id}" style="color:#0D6EFD;">Lihat detail →</a>
           </div>`
        );
      });
    })();
    return () => { cancelled = true; };
  }, [drivers, ships]);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      routeLayer.current?.clearLayers();
      if (!showRoutes) return;

      returnRoutes.forEach((r) => {
        const line = L.polyline(r.points, {
          color: '#facc15',
          weight: 4,
          opacity: 0.9,
          dashArray: '8 6',
        }).addTo(routeLayer.current!);
        line.bindPopup(
          `<div style="font-size:12px;min-width:160px;">
             <b>${r.name}</b> — kembali ke gudang<br/>
             Rute kembali · ${r.points.length} titik
           </div>`
        );
        if (r.points.length > 1) {
          const [aLat, aLng] = r.points[0];
          L.circleMarker([aLat, aLng], { radius: 4, color: '#fff', weight: 2, fillColor: '#facc15', fillOpacity: 1 }).addTo(routeLayer.current!);
          const [bLat, bLng] = r.points[r.points.length - 1];
          L.circleMarker([bLat, bLng], { radius: 5, color: '#fff', weight: 2, fillColor: '#a16207', fillOpacity: 1 }).addTo(routeLayer.current!);
        }
      });

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
     
  }, [routes, showRoutes, returnRoutes]);

  const routeFallback = (r: RouteLine) => r.points.length === 2;

  function focusShip(s: ShipPos) {
    setSelectedShipId(s.id);
    const map = leafletRef.current;
    if (!map) return;
    const driverPos = s.driver ? drivers.find((d) => d.name === s.driver) : undefined;
    const target: [number, number] | null =
      driverPos && (s.status === 'IN_TRANSIT' || s.status === 'DISPATCHED' || s.status === 'OUT_FOR_DELIVERY' || s.status === 'ARRIVED_AT_HUB')
        ? [driverPos.latitude, driverPos.longitude]
        : null;
    const marker = shipMarkers.current.get(s.id);
    const z = Math.max(map.getZoom(), 13);
    if (target) {
      map.flyTo(target, Math.max(z, 14), { duration: 0.6 });
      return;
    }
    if (marker) {
      const ll = marker.getLatLng();
      map.flyTo([ll.lat, ll.lng], z, { duration: 0.6 });
      setTimeout(() => marker.openPopup(), 650);
      return;
    }
    if (s.destLat != null && s.destLng != null) map.flyTo([s.destLat, s.destLng], z, { duration: 0.6 });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Live Tracking Map</h1>
          <p className="text-sm text-[#667085]">
            Posisi driver & shipment · Update otomatis tiap 15 detik{lastUpdate && ` · Terakhir: ${lastUpdate}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-[#0D6EFD]" /> Driver</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-400" /> Driver Kembali</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-600" /> Shipment</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-violet-500" /> Geofence</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-5 rounded bg-emerald-500" /> Rute</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-5 rounded bg-yellow-300" /> Rute Kembali</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#667085]">
            <input
              type="checkbox"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
              className="h-4 w-4 rounded border-[#E4E7EC] text-[#0D6EFD] focus:ring-[#0D6EFD]"
            />
            Tampilkan Rute
          </label>
          {routeLoaded && (
            <span className="rounded-full bg-[#E4E7EC] px-2 py-0.5 text-[11px] font-semibold text-[#667085]">
              {routes.length} rute {routes.some(routeFallback) ? '(beberapa fallback garis lurus)' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="h-[70vh] overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-3">
          <div ref={mapRef} className="h-full w-full" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-3 text-sm font-bold text-[#101828]">Driver Aktif ({drivers.length})</h2>
          <div className="space-y-3">
            {drivers.map((d) => (
              <div key={d.driverId} className="rounded-lg border border-[#E4E7EC] p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
                    {d.photo ? (
                      <img src={d.photo} alt={d.name} className="h-6 w-6 rounded-full border border-[#E4E7EC] object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0D6EFD]/10 text-[10px] font-bold text-[#0D6EFD]">{d.name.slice(0, 1).toUpperCase()}</span>
                    )}
                    {d.name}
                    {d.returning && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">Kembali ke Gudang</span>
                    )}
                  </span>
                  <span className="text-xs text-[#667085]">{d.speed != null ? `${d.speed} km/h` : '-'}</span>
                </div>
                <div className="text-xs text-[#667085]">{d.vehicleNumber || '-'} · Update {new Date(d.updatedAt).toLocaleTimeString('id-ID')}</div>
                {d.returning && d.warehouseName && <div className="mt-1 text-[11px] text-yellow-700">Menuju: {d.warehouseName}</div>}
              </div>
            ))}
            {drivers.length === 0 && <p className="text-sm text-[#667085]">Belum ada data GPS 2 jam terakhir</p>}
          </div>
          <h2 className="mb-3 mt-5 text-sm font-bold text-[#101828]">Shipment Aktif ({ships.length})</h2>
          <div className="space-y-3">
            {ships.map((s) => (
              <button
                key={s.id}
                onClick={() => focusShip(s)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedShipId === s.id ? 'border-[#0D6EFD] bg-[#0D6EFD]/5 shadow-sm' : 'border-[#E4E7EC] hover:border-[#0D6EFD]/30 hover:bg-[#F7F9FC]'
                }`}
              >
                <div className="font-mono text-xs font-semibold text-[#0D6EFD]">{s.trackingNumber}</div>
                <div className="mt-1"><StatusBadge status={s.status} /></div>
                <div className="mt-1 text-xs text-[#667085]">{s.origin} → {s.destination}</div>
                {s.originLat != null && s.destLat != null && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-[#667085]">
                    <span className="h-1.5 w-4 rounded" style={{ background: statusColor(s.status) }} />
                    Rute tersedia
                  </div>
                )}
              </button>
            ))}
            {ships.length === 0 && <p className="text-sm text-[#667085]">Tidak ada shipment aktif</p>}
          </div>
          <h2 className="mb-3 mt-5 text-sm font-bold text-[#101828]">Geofence Aktif ({geofences.filter((g) => g.active).length})</h2>
          <div className="space-y-2">
            {geofences.filter((g) => g.active).map((g) => (
              <div key={g.id} className="rounded-lg border border-[#E4E7EC] p-3">
                <div className="text-sm font-semibold text-[#101828]">{g.name}</div>
                <div className="text-xs text-[#667085]">{g.type} · radius {g.radiusMeters} m</div>
              </div>
            ))}
            {geofences.length === 0 && <p className="text-sm text-[#667085]">Tidak ada geofence</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
