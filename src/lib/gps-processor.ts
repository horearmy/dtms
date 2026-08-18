// src/lib/gps-processor.ts
// GPS processing pipeline: receive raw point → store → broadcast → ETA update.
import { prisma } from './prisma';
import { enqueue, registerJobHandler, startQueueWorker } from './job-queue';
import { broadcast } from './sse-bus';
import { calculateEta } from './eta-engine';

// Start the queue worker so pending retries are processed
startQueueWorker();

interface GpsPayload {
  tenantId?: string;
  driverId: string;
  vehicleId?: string;
  shipmentId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  battery?: number;
  sequence?: number;
}

export function ingestGps(payload: GpsPayload) {
  enqueue('GPS_INGEST', payload as unknown as Record<string, unknown>);
}

registerJobHandler('GPS_INGEST', async (job) => {
  const p = job.payload as unknown as GpsPayload;

  // 1. Store raw GPS
  await prisma.gpsLog.create({
    data: {
      driverId: p.driverId,
      vehicleId: p.vehicleId ?? null,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? null,
      heading: p.heading ?? null,
      accuracy: p.accuracy ?? null,
      battery: p.battery ?? null,
    },
  });

  // 2. Broadcast current position to SSE subscribers
  const channel = p.tenantId ? `tenant:${p.tenantId}` : 'global';
  broadcast(channel, 'gps:point', {
    driverId: p.driverId,
    vehicleId: p.vehicleId ?? null,
    shipmentId: p.shipmentId ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
    speed: p.speed ?? null,
    heading: p.heading ?? null,
    battery: p.battery ?? null,
    receivedAt: new Date().toISOString(),
  });

  // 3. If shipment is assigned, calculate ETA and broadcast
  if (p.shipmentId) {
    const eta = await calculateEta(p.shipmentId, p.latitude, p.longitude);
    broadcast(channel, 'shipment:eta', {
      shipmentId: p.shipmentId,
      eta: eta.estimatedArrival,
      slaStatus: eta.slaStatus,
      distanceRemaining: eta.distanceRemaining,
    });
  }
});
