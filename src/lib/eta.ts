import { SLA_HOURS } from './constants';

export type SLAType = 'ON_TIME' | 'AT_RISK' | 'BREACHED' | 'DONE' | 'NONE';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function slaDeadlineFor(serviceType: string, createdAt: Date) {
  const hours = SLA_HOURS[serviceType] || 96;
  return new Date(createdAt.getTime() + hours * 3600000);
}

export function getSLA(
  status: string,
  slaDeadline: Date | null | undefined,
  serviceType?: string
): { type: SLAType; remainingMs: number; deadline: Date | null } {
  if (!slaDeadline) return { type: 'NONE', remainingMs: 0, deadline: null };
  if (['DELIVERED', 'RETURNED'].includes(status)) {
    return { type: 'DONE', remainingMs: 0, deadline: slaDeadline };
  }
  const remaining = slaDeadline.getTime() - Date.now();
  if (remaining < 0) return { type: 'BREACHED', remainingMs: remaining, deadline: slaDeadline };
  const totalHours = SLA_HOURS[serviceType || ''] || 96;
  const usedRatio = (totalHours * 3600000 - remaining) / (totalHours * 3600000);
  if (usedRatio >= 0.8) {
    return { type: 'AT_RISK', remainingMs: remaining, deadline: slaDeadline };
  }
  return { type: 'ON_TIME', remainingMs: remaining, deadline: slaDeadline };
}

export function dynamicETA({
  distanceKm,
  avgSpeedKmh = 35,
  stops = 2,
}: {
  distanceKm: number;
  avgSpeedKmh?: number;
  stops?: number;
}) {
  const driveMs = (distanceKm / avgSpeedKmh) * 3600000;
  const stopsMs = stops * 15 * 60000;
  return new Date(Date.now() + driveMs + stopsMs);
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return 'Terlambat';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours <= 0) return `${minutes} mnt`;
  return `${hours} jam ${minutes} mnt`;
}