// src/lib/eta-engine.ts
// ETA calculation engine — multi-stop, route-based, SLA-aware.
import { prisma } from './prisma';

interface EtaResult {
  estimatedArrival: Date | null;
  estimatedDuration: number | null; // minutes
  distanceRemaining: number | null; // km
  slaStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | null;
  stopsRemaining: number;
  nextStop: { name: string; distance: number } | null;
}

// Haversine distance (km)
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Speed models by time of day (km/h)
function getAverageSpeed(hour: number): number {
  // Rush hour: 7-9 AM, 4-7 PM
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) return 20;
  // Night: 10 PM - 5 AM
  if (hour >= 22 || hour <= 5) return 45;
  // Normal
  return 35;
}

// Distance penalty for road routing (straight line * factor)
const ROAD_FACTOR = 1.3;

export async function calculateEta(
  shipmentId: string,
  currentLat: number,
  currentLng: number,
): Promise<EtaResult> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      destLat: true,
      destLng: true,
      destination: true,
      slaDeadline: true,
      status: true,
      originLat: true,
      originLng: true,
    },
  });

  if (!shipment?.destLat || !shipment?.destLng) {
    return { estimatedArrival: null, estimatedDuration: null, distanceRemaining: null, slaStatus: null, stopsRemaining: 0, nextStop: null };
  }

  // Get remaining stops
  const stops = await prisma.shipmentStop.findMany({
    where: { shipmentId },
    orderBy: { seq: 'asc' },
  });

  const now = new Date();
  const hour = now.getHours();
  const avgSpeed = getAverageSpeed(hour);

  let totalDistance = 0;
  let lastLat = currentLat;
  let lastLng = currentLng;

  // Calculate through remaining stops
  const stopDetails: { name: string; distance: number }[] = [];
  for (const stop of stops) {
    if (stop.latitude && stop.longitude) {
      const dist = haversine(lastLat, lastLng, stop.latitude, stop.longitude) * ROAD_FACTOR;
      totalDistance += dist;
      stopDetails.push({ name: stop.label || `Stop ${stop.seq}`, distance: Math.round(dist * 100) / 100 });
      lastLat = stop.latitude;
      lastLng = stop.longitude;
    }
  }

  // Final leg to destination
  const finalDist = haversine(lastLat, lastLng, shipment.destLat, shipment.destLng) * ROAD_FACTOR;
  totalDistance += finalDist;

  const durationMin = Math.round((totalDistance / avgSpeed) * 60);
  const arrival = new Date(now.getTime() + durationMin * 60 * 1000);

  let slaStatus: EtaResult['slaStatus'] = null;
  if (shipment.slaDeadline) {
    const margin = 15; // 15 min buffer
    if (arrival.getTime() > shipment.slaDeadline.getTime()) {
      slaStatus = 'BREACHED';
    } else if (arrival.getTime() + margin * 60 * 1000 > shipment.slaDeadline.getTime()) {
      slaStatus = 'AT_RISK';
    } else {
      slaStatus = 'ON_TRACK';
    }
  }

  return {
    estimatedArrival: arrival,
    estimatedDuration: durationMin,
    distanceRemaining: Math.round(totalDistance * 100) / 100,
    slaStatus,
    stopsRemaining: stops.length,
    nextStop: stopDetails[0] || null,
  };
}

// Batch ETA for multiple shipments
export async function calculateBatchEta(
  shipments: { id: string; currentLat: number; currentLng: number }[],
): Promise<Map<string, EtaResult>> {
  const results = new Map<string, EtaResult>();
  for (const s of shipments) {
    results.set(s.id, await calculateEta(s.id, s.currentLat, s.currentLng));
  }
  return results;
}
