// src/lib/eta-engine.ts
// ETA calculation engine.
import { prisma } from './prisma';

interface EtaResult {
  estimatedArrival: Date | null;
  estimatedDuration: number | null; // minutes
  distanceRemaining: number | null; // km
  slaStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | null;
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

// Average urban speed km/h
const AVG_SPEED_KMH = 35;

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
      slaDeadline: true,
      status: true,
    },
  });

  if (!shipment?.destLat || !shipment?.destLng) {
    return { estimatedArrival: null, estimatedDuration: null, distanceRemaining: null, slaStatus: null };
  }

  const dist = haversine(currentLat, currentLng, shipment.destLat, shipment.destLng);
  const durationMin = Math.round((dist / AVG_SPEED_KMH) * 60);
  const arrival = new Date(Date.now() + durationMin * 60 * 1000);

  let slaStatus: EtaResult['slaStatus'] = null;
  if (shipment.slaDeadline) {
    const margin = 10; // 10 min buffer
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
    distanceRemaining: Math.round(dist * 100) / 100,
    slaStatus,
  };
}
