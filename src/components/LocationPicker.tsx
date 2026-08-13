"use client";

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { addGoogleStyleTiles } from '@/lib/mapTiles';
import { inputCls } from '@/components/ui';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const EMAIL = 'wendha.agus@gmail.com';

export type PickedLocation = {
  lat: number | null;
  lng: number | null;
  address: string;
  city: string;
  postalCode: string;
};

type Suggestion = { lat: number; lng: number; displayName: string; address: Record<string, string> };

type Props = {
  value: PickedLocation;
  onChange: (loc: PickedLocation) => void;
  mapHeight?: string;
};

function deriveFromAddress(address: Record<string, string>, displayName: string) {
  const road = address.road || address.pedestrian || address.footway || address.path || address.neighbourhood || address.amenity || address.building || '';
  const hnum = address.house_number || '';
  const area = [address.neighbourhood, address.suburb, address.borough, address.quarter].filter(Boolean).join(', ');
  const addressText = [hnum, road, area].filter(Boolean).join(', ') || displayName || '';
  const city = address.city || address.town || address.municipality || address.village || address.county || address.state_district || address.state || '';
  return { address: addressText, city, postalCode: address.postcode || '' };
}

export default function LocationPicker({ value, onChange, mapHeight = 'h-72' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const LRef = useRef<typeof import('leaflet') | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<string>(
    value.lat != null && value.lng != null ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Belum dipilih'
  );

  function makePinIcon(L: typeof import('leaflet')) {
    return L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;background:#2563eb;border:2.5px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.35);"><span style="transform:rotate(45deg);font-size:13px;line-height:1;">📍</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }

  function placeMarker(lat: number, lng: number): void {
    const L = LRef.current;
    if (!L || !mapInst.current) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lng], { icon: makePinIcon(L) }).addTo(mapInst.current);
  }

  async function reverseGeocode(lat: number, lng: number) {
    setCoords(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    const res = await fetch(
      `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&email=${EMAIL}`
    );
    if (!res.ok) return;
    const json = await res.json();
    const parts = deriveFromAddress(json.address || {}, json.display_name || '');
    onChange({ lat, lng, ...parts });
  }

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      LRef.current = L;
      const hasCoords = value.lat != null && value.lng != null;
      const map = L.map(mapRef.current).setView(
        hasCoords ? [value.lat as number, value.lng as number] : [-6.21, 106.83],
        hasCoords ? 16 : 11
      );
      addGoogleStyleTiles(map, L);
      if (hasCoords) {
        markerRef.current = L.marker([value.lat as number, value.lng as number], { icon: makePinIcon(L) }).addTo(map);
      }
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        placeMarker(e.latlng.lat, e.latlng.lng);
        void reverseGeocode(e.latlng.lat, e.latlng.lng);
      });
      mapInst.current = map;
    })();
    return () => {
      cancelled = true;
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        markerRef.current = null;
        LRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = search.trim();
      if (!q) {
        setSuggestions([]);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(
          `${NOMINATIM}/search?format=jsonv2&limit=6&addressdetails=1&email=${EMAIL}&q=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string; address?: Record<string, string> }>;
        setSuggestions(
          (Array.isArray(arr) ? arr : []).map((s) => ({
            lat: Number(s.lat),
            lng: Number(s.lon),
            displayName: s.display_name || '',
            address: s.address || {},
          }))
        );
      } catch {
        setSuggestions([]);
      } finally {
        setBusy(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [search]);

  function pickSuggestion(s: Suggestion) {
    const parts = deriveFromAddress(s.address, s.displayName);
    setSearch('');
    setSuggestions([]);
    const map = mapInst.current;
    if (map) {
      map.setView([s.lat, s.lng], 17);
      placeMarker(s.lat, s.lng);
    }
    setCoords(`${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`);
    onChange({ lat: s.lat, lng: s.lng, ...parts });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation tidak didukung browser ini');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInst.current?.setView([latitude, longitude], 16);
        placeMarker(latitude, longitude);
        void reverseGeocode(latitude, longitude);
      },
      () => alert('Gagal mengambil lokasi saat ini'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kota / tempat untuk memilih di peta..."
              className={inputCls}
            />
            {busy && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">...</span>}
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            📍 Lokasi Saya
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="block w-full truncate px-3 py-2 text-left text-xs text-slate-700 hover:bg-brand-50"
              >
                {s.displayName}
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={mapRef} className={`${mapHeight} w-full rounded-lg border border-slate-200`} />
      <p className="text-[11px] text-slate-500">
        Klik pada peta untuk menandai lokasi secara akurat. Koordinat & alamat terisi otomatis.{' '}
        <span className="font-semibold text-slate-600">{coords}</span>
      </p>
    </div>
  );
}