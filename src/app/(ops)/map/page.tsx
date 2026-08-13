"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import StatusBadge from '@/components/StatusBadge';

type DriverPos = {
  driverId: string; name: string; vehicleNumber: string | null;
  latitude: number; longitude: number; speed: number | null; battery: number | null; updatedAt: string;
};
type ShipPos = {
  id: string; trackingNumber: string; status: string; destination: string;
  driver: string | null; vehicle: string | null; destLat: number | null; destLng: number | null;
};
type Geofence = {
  id: string; name: string; latitude: number; longitude: number; radiusMeters: number; type: string; active: boolean;
};

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const driverLayer = useRef<L.LayerGroup | null>(null);
  const shipLayer = useRef<L.LayerGroup | null>(null);
  const geofenceLayer = useRef<L.LayerGroup | null>(null);
  const [drivers, setDrivers] = useState<DriverPos[]>([]);
  const [ships, setShips] = useState<ShipPos[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
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
        const color = s.status === 'DELIVERED' ? '#059669' : s.status === 'DELIVERY_FAILED' ? '#dc2626' : '#d97706';
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
             Tujuan: ${s.destination}<br/>
             Driver: ${s.driver || '-'}<br/>
             <a href="/shipments/${s.id}" style="color:#1d4ed8;">Lihat detail →</a>
           </div>`
        );
      });
    })();
    return () => { cancelled = true; };
  }, [drivers, ships]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Tracking Map</h1>
          <p className="text-sm text-slate-500">
            Posisi driver & shipment · Update otomatis tiap 15 detik{lastUpdate && ` · Terakhir: ${lastUpdate}`}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-brand-600" /> Driver</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-600" /> Shipment</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-violet-500" /> Geofence</span>
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
                <div className="mt-1 text-xs text-slate-500">{s.destination}</div>
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