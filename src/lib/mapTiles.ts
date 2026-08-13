"use client";

import type L from 'leaflet';

const GOOGLE_URL = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const CARTO_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export function addGoogleStyleTiles(map: L.Map, L: typeof import('leaflet')): void {
  const google = L.tileLayer(GOOGLE_URL, {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Map data &copy; Google',
  });
  google.addTo(map);

  let errors = 0;
  google.on('tileerror', () => {
    errors += 1;
    if (errors < 4 || !map.hasLayer(google)) return;
    map.removeLayer(google);
    L.tileLayer(CARTO_URL, {
      subdomains: ['a', 'b', 'c', 'd'],
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);
  });
}
