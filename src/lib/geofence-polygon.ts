export type LatLng = { lat: number; lng: number };

export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) && (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function parsePoints(raw: unknown): LatLng[] | null {
  if (!Array.isArray(raw)) return null;
  const pts: LatLng[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && p.length >= 2) {
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
    } else if (p && typeof p === 'object' && 'lat' in (p as any) && 'lng' in (p as any)) {
      const lat = Number((p as any).lat);
      const lng = Number((p as any).lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
    }
  }
  return pts;
}

export function validatePolygonPoints(points: LatLng[]): string | null {
  if (points.length < 3) return 'Polygon minimal 3 titik';
  if (points.length > 100) return 'Polygon maksimal 100 titik';
  for (const p of points) {
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return 'Koordinat titik di luar rentang';
  }
  return null;
}

export function centroid(points: LatLng[]): LatLng {
  let lat = 0, lng = 0;
  for (const p of points) { lat += p.lat; lng += p.lng; }
  return { lat: lat / points.length, lng: lng / points.length };
}
