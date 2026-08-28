"use client";

type Props = {
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  currentLat: number | null;
  currentLng: number | null;
  status: string;
  gpsUpdatedAt?: string | null;
};

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function progressPercent(oLat: number, oLng: number, dLat: number, dLng: number, cLat: number, cLng: number): number {
  const R = 6371;
  const x1 = toRad(oLat);
  const y1 = toRad(oLng);
  const x2 = toRad(dLat);
  const y2 = toRad(dLng);
  const xc = toRad(cLat);
  const yc = toRad(cLng);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (x1 === xc && y1 === yc) ? 100 : 0;

  // Parameter proyeksi titik saat ini ke segmen asal→tujuan (koordinat lat/lng konversi)
  const t = clamp(((xc - x1) * dx + (yc - y1) * dy) / lenSq, 0, 1);
  const px = x1 + t * dx;
  const py = y1 + t * dy;

  const hav = (a: number, b: number, c: number, d: number) => {
    const ha = Math.sin((c - a) / 2) ** 2 + Math.cos(a) * Math.cos(c) * Math.sin((d - b) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(ha));
  };

  const totalKm = hav(x1, y1, x2, y2);
  const traveledKm = hav(x1, y1, px, py);
  const pct = totalKm > 0 ? (traveledKm / totalKm) * 100 : 0;
  return clamp(pct, 0, 100);
}

const ON_ROAD = ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED_AT_HUB', 'OUT_FOR_DELIVERY'];
const FINISHED = ['DELIVERED', 'RETURNED'];

export default function JourneyProgress({ originLat, originLng, destLat, destLng, currentLat, currentLng, status, gpsUpdatedAt }: Props) {
  const hasRoute = originLat != null && originLng != null && destLat != null && destLng != null;

  if (FINISHED.includes(status) && hasRoute) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-emerald-700">Estimasi Perjalanan</span>
          <span className="font-bold text-emerald-700">100% · Selesai</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }

  if (!ON_ROAD.includes(status) || !hasRoute) return null;

  const pct = currentLat != null && currentLng != null && currentLat !== 0 && currentLng !== 0
    ? Math.round(progressPercent(originLat!, originLng!, destLat!, destLng!, currentLat, currentLng))
    : null;

  const color = pct == null
    ? 'bg-[#E4E7EC]'
    : pct < 100
      ? 'bg-[#0D6EFD]'
      : 'bg-emerald-500';

  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-[#101828]">Estimasi Perjalanan</span>
        <span className="font-bold text-[#0D6EFD]">{pct == null ? '—' : `${pct}%`}</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#E4E7EC]">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: pct == null ? '0%' : `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-[#667085]">
        {pct == null
          ? 'Menunggu sinyal GPS driver untuk menghitung progres'
          : pct >= 100
            ? 'Driver diperkirakan telah tiba di tujuan'
            : `Perkiraan berdasarkan posisi driver ${gpsUpdatedAt ? `(update ${gpsUpdatedAt})` : ''}`}
      </p>
    </div>
  );
}
