// src/app/api/tracking/ingest/route.ts
// Tracking Gateway — authenticated GPS ingestion endpoint.
import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { ingestGps } from '@/lib/gps-processor';

interface GpsIngestRequest {
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

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

  const body = await req.json();

  const requestKey = req.headers.get('idempotency-key')?.trim();
  if (requestKey && (requestKey.length < 8 || requestKey.length > 200)) {
    return NextResponse.json({ error: 'Idempotency-Key harus berukuran 8-200 karakter' }, { status: 400 });
  }

  // Accept single point or batch
  const points: GpsIngestRequest[] = Array.isArray(body.points) ? body.points : [body];

  const jobs: { id: string }[] = [];
  for (const [index, pt] of points.slice(0, 100).entries()) {
    if (!pt.driverId || !Number.isFinite(pt.latitude) || !Number.isFinite(pt.longitude) || pt.latitude < -90 || pt.latitude > 90 || pt.longitude < -180 || pt.longitude > 180) continue;
    ingestGps({
      tenantId: session?.tenantId ?? undefined,
      driverId: pt.driverId,
      vehicleId: pt.vehicleId,
      shipmentId: pt.shipmentId,
      latitude: pt.latitude,
      longitude: pt.longitude,
      speed: pt.speed,
      heading: pt.heading,
      accuracy: pt.accuracy,
      battery: pt.battery,
      sequence: pt.sequence,
      ingestKey: requestKey ? `${requestKey}:${index}` : undefined,
    }, session?.id);
    jobs.push({ id: 'queued' });
  }

  return NextResponse.json({ accepted: jobs.length });
}

export async function GET() {
  return NextResponse.json({ message: 'Tracking Gateway is running. Use POST to ingest GPS points.' });
}
