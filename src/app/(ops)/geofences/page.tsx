"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Modal, Field, inputCls, btnPrimary, btnGhost } from '@/components/ui';
import { formatDate } from '@/lib/constants';
import { csrfHeaders } from '@/lib/csrf';
import { addGoogleStyleTiles } from '@/lib/mapTiles';

type LatLng = { lat: number; lng: number };

type Geofence = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  shape: string;
  points: LatLng[] | null;
  type: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  events: { id: string; eventType: string; driver: { name: string }; createdAt: string }[];
};

function parsePoints(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw as any[]) {
    if (Array.isArray(p)) out.push({ lat: Number(p[0]), lng: Number(p[1]) });
    else if (p && typeof p === 'object') out.push({ lat: Number((p as any).lat), lng: Number((p as any).lng) });
  }
  return out.filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}

function GeofenceMapPicker({
  shape,
  center,
  radius,
  points,
  onChangeCenter,
  onChangePoints,
}: {
  shape: 'CIRCLE' | 'POLYGON';
  center: LatLng;
  radius: number;
  points: LatLng[];
  onChangeCenter: (c: LatLng) => void;
  onChangePoints: (pts: LatLng[]) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const shapeRef = useRef(shape);
  const pointsRef = useRef(points);
  const onChangeCenterRef = useRef(onChangeCenter);
  const onChangePointsRef = useRef(onChangePoints);
  useEffect(() => { shapeRef.current = shape; }, [shape]);
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => { onChangeCenterRef.current = onChangeCenter; }, [onChangeCenter]);
  useEffect(() => { onChangePointsRef.current = onChangePoints; }, [onChangePoints]);

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current).setView([center.lat, center.lng], shapeRef.current === 'POLYGON' && pointsRef.current.length ? 14 : 13);
      addGoogleStyleTiles(map, L);
      layerGroup.current = L.layerGroup().addTo(map);
      map.on('click', (e: any) => {
        if (shapeRef.current === 'POLYGON') {
          onChangePointsRef.current([...pointsRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }]);
        } else {
          onChangeCenterRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
      mapInst.current = map;
      setTimeout(() => map.invalidateSize(), 150);
    })();
    return () => {
      cancelled = true;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        layerGroup.current = null;
        LRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync view when shape changes externally? Keep simple.

  useEffect(() => {
    const L = LRef.current;
    const g = layerGroup.current;
    if (!L || !g) return;
    g.clearLayers();
    if (shape === 'CIRCLE') {
      L.circle([center.lat, center.lng], { radius, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.15, weight: 2 }).addTo(g);
      L.circleMarker([center.lat, center.lng], { radius: 6, color: '#2563eb', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(g);
    } else {
      if (points.length >= 2) {
        L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), { color: '#7c3aed', weight: 2, dashArray: '6 4' }).addTo(g);
      }
      if (points.length >= 3) {
        L.polygon(points.map((p) => [p.lat, p.lng] as [number, number]), { color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.15, weight: 2 }).addTo(g);
      }
      points.forEach((p, idx) => {
        L.circleMarker([p.lat, p.lng], { radius: 5, color: '#7c3aed', fillColor: idx === 0 ? '#f59e0b' : '#fff', fillOpacity: 1, weight: 2 }).addTo(g).bindTooltip(String(idx + 1), { permanent: false });
      });
    }
  }, [shape, center, radius, points]);

  return <div ref={mapRef} className="h-64 w-full rounded-lg border border-[#E4E7EC]" />;
}

export default function GeofencesPage() {
  const [items, setItems] = useState<Geofence[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Geofence | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    shape: 'CIRCLE' as 'CIRCLE' | 'POLYGON',
    latitude: '',
    longitude: '',
    radiusMeters: '500',
    points: [] as LatLng[],
    type: 'OPERATIONAL_AREA',
    description: '',
    active: 'true',
  });

  async function load() {
    const res = await fetch('/api/geofences');
    if (res.ok) {
      const data = await res.json();
      const normalized: Geofence[] = (Array.isArray(data) ? data : []).map((g: any) => ({
        ...g,
        shape: g.shape || 'CIRCLE',
        points: parsePoints(g.points),
      }));
      setItems(normalized);
    }
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEdit(null);
    setForm({ name: '', shape: 'CIRCLE', latitude: '', longitude: '', radiusMeters: '500', points: [], type: 'OPERATIONAL_AREA', description: '', active: 'true' });
    setMsg('');
    setOpen(true);
  }
  function openEdit(g: Geofence) {
    setEdit(g);
    const isPoly = (g.shape as string) === 'POLYGON';
    setForm({
      name: g.name,
      shape: isPoly ? 'POLYGON' : 'CIRCLE',
      latitude: String(g.latitude),
      longitude: String(g.longitude),
      radiusMeters: String(g.radiusMeters),
      points: isPoly ? parsePoints(g.points) : [],
      type: g.type,
      description: g.description || '',
      active: String(g.active),
    });
    setMsg('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    const isPoly = form.shape === 'POLYGON';
    if (isPoly && form.points.length < 3) {
      setMsg('Polygon minimal 3 titik. Klik pada peta untuk menambah titik.');
      setLoading(false);
      return;
    }
    const payload: any = {
      name: form.name,
      shape: form.shape,
      type: form.type,
      description: form.description || null,
      active: form.active === 'true',
    };
    if (isPoly) {
      payload.points = form.points;
    } else {
      payload.latitude = Number(form.latitude);
      payload.longitude = Number(form.longitude);
      payload.radiusMeters = Number(form.radiusMeters);
      if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
        setMsg('Latitude dan longitude wajib diisi dengan angka valid');
        setLoading(false);
        return;
      }
    }
    const res = await fetch(edit ? `/api/geofences/${edit.id}` : '/api/geofences', {
      method: edit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setMsg(data.error || 'Gagal menyimpan');
    setOpen(false);
    await load();
  }
  async function toggleActive(g: Geofence) {
    await fetch(`/api/geofences/${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ active: !g.active }),
    });
    await load();
  }
  async function remove(g: Geofence) {
    if (!confirm(`Hapus geofence "${g.name}"?`)) return;
    const res = await fetch(`/api/geofences/${g.id}`, { method: 'DELETE', headers: csrfHeaders() });
    if (res.ok) await load();
  }

  const typeLabel: Record<string, string> = {
    WAREHOUSE: 'Gudang',
    HUB: 'Hub',
    OPERATIONAL_AREA: 'Area Operasional',
    DESTINATION: 'Destinasi',
  };
  const typeColor: Record<string, string> = {
    WAREHOUSE: 'bg-indigo-100 text-indigo-700',
    HUB: 'bg-amber-100 text-amber-700',
    OPERATIONAL_AREA: 'bg-sky-100 text-sky-700',
    DESTINATION: 'bg-emerald-100 text-emerald-700',
  };

  const centerForPicker: LatLng = {
    lat: Number(form.latitude) || (form.points[0]?.lat ?? -6.21),
    lng: Number(form.longitude) || (form.points[0]?.lng ?? 106.83),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#101828]">Geofencing</h1>
          <p className="text-sm text-[#667085]">Perimeter area — alert otomatis saat driver masuk/keluar. Dukung lingkaran (radius) dan polygon fleksibel.</p>
        </div>
        <button onClick={openNew} className={btnPrimary}>+ Tambah Geofence</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((g) => {
          const isPoly = (g.shape as string) === 'POLYGON';
          return (
            <div key={g.id} className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[#101828]">{g.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeColor[g.type] || 'bg-[#F7F9FC] text-[#667085]'}`}>{typeLabel[g.type] || g.type}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isPoly ? 'bg-violet-100 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>{isPoly ? `Polygon · ${g.points?.length || 0} titik` : 'Circle'}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#667085]">
                    {isPoly
                      ? g.points && g.points.length
                        ? `${g.points.length} titik · pusat ${g.latitude.toFixed(4)}, ${g.longitude.toFixed(4)}`
                        : 'Polygon'
                      : `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)} · radius ${Math.round(g.radiusMeters)} m`}
                  </p>
                  {g.description && <p className="mt-1 text-xs text-[#667085]">{g.description}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${g.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E4E7EC] text-[#667085]'}`}>{g.active ? 'Aktif' : 'Nonaktif'}</span>
              </div>

              <div className="mt-3 space-y-1 border-t border-[#E4E7EC] pt-3">
                {g.events.length === 0 ? (
                  <p className="text-xs text-[#667085]">Belum ada event masuk/keluar</p>
                ) : (
                  g.events.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between text-xs">
                      <span className={ev.eventType === 'ENTER' ? 'font-semibold text-emerald-600' : 'font-semibold text-red-500'}>
                        {ev.eventType === 'ENTER' ? 'MASUK' : 'KELUAR'} · {ev.driver?.name}
                      </span>
                      <span className="text-[#667085]">{formatDate(ev.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex gap-3 text-xs">
                <button onClick={() => toggleActive(g)} className="font-semibold text-[#667085] hover:underline">{g.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button onClick={() => openEdit(g)} className="font-semibold text-[#0D6EFD] hover:underline">Edit</button>
                <button onClick={() => remove(g)} className="font-semibold text-red-500 hover:underline">Hapus</button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#E4E7EC] bg-white p-10 text-center text-sm text-[#667085]">
            Belum ada geofence
          </p>
        )}
      </div>

      <Modal open={open} wide title={edit ? 'Edit Geofence' : 'Tambah Geofence'} onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Nama" required>
            <input id="geofence-name" name="geofenceName" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Gudang Pusat Jakarta atau Area Polygon Gudang" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bentuk" required>
              <select id="geofence-shape" name="geofenceShape" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value as any })} className={inputCls}>
                <option value="CIRCLE">Lingkaran (radius)</option>
                <option value="POLYGON">Polygon (multi titik)</option>
              </select>
            </Field>
            <Field label="Tipe">
              <select id="geofence-type" name="geofenceType" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
                <option value="WAREHOUSE">Gudang</option>
                <option value="HUB">Hub</option>
                <option value="OPERATIONAL_AREA">Area Operasional</option>
                <option value="DESTINATION">Destinasi</option>
              </select>
            </Field>
          </div>

          {form.shape === 'CIRCLE' ? (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Latitude" required>
                <input id="geofence-lat" name="geofenceLat" required type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className={inputCls} placeholder="-6.213" />
              </Field>
              <Field label="Longitude" required>
                <input id="geofence-lng" name="geofenceLng" required type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className={inputCls} placeholder="106.845" />
              </Field>
              <Field label="Radius (meter)">
                <input id="geofence-radius" name="geofenceRadius" type="number" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} className={inputCls} />
              </Field>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                Polygon: klik pada peta untuk menambah titik secara berurutan (minimal 3). Titik pertama berwarna oranye.
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-[#667085]">{form.points.length} titik</span>
                <button type="button" onClick={() => setForm({ ...form, points: [] })} className="font-semibold text-red-500 hover:underline">Hapus semua titik</button>
                <button type="button" onClick={() => setForm({ ...form, points: form.points.slice(0, -1) })} className="font-semibold text-[#667085] hover:underline">Undo titik</button>
              </div>
              {form.points.length > 0 && (
                <div className="max-h-28 overflow-auto rounded-lg border border-[#E4E7EC] bg-[#F7F9FC] p-2 text-[11px] font-mono text-[#344054]">
                  {form.points.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span>{i + 1}. {p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                      <button type="button" onClick={() => setForm({ ...form, points: form.points.filter((_, idx) => idx !== i) })} className="ml-2 text-red-500 hover:underline">hapus</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium text-[#344054]">Peta {form.shape === 'POLYGON' ? '(klik untuk tambah titik polygon)' : '(klik untuk set pusat lingkaran)'}</div>
            <GeofenceMapPicker
              shape={form.shape}
              center={centerForPicker}
              radius={Number(form.radiusMeters) || 500}
              points={form.points}
              onChangeCenter={(c) => setForm({ ...form, latitude: String(c.lat), longitude: String(c.lng) })}
              onChangePoints={(pts) => setForm({ ...form, points: pts })}
            />
          </div>

          <Field label="Deskripsi">
            <input id="geofence-desc" name="geofenceDesc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Status">
            <select id="geofence-active" name="geofenceActive" value={form.active} onChange={(e) => setForm({ ...form, active: e.target.value })} className={inputCls}>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </Field>
          {msg && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Batal</button>
            <button type="submit" disabled={loading} className={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
