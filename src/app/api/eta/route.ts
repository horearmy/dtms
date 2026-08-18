// src/app/api/eta/route.ts
// ETA calculation endpoint.
import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { calculateEta } from '@/lib/eta-engine';

export async function GET(req: NextRequest) {
  const { error } = await guard();
  if (error) return error;

  const url = new URL(req.url);
  const shipmentId = url.searchParams.get('shipmentId');
  const lat = parseFloat(url.searchParams.get('lat') || '0');
  const lng = parseFloat(url.searchParams.get('lng') || '0');

  if (!shipmentId || !lat || !lng) {
    return NextResponse.json({ error: 'shipmentId, lat, lng required' }, { status: 400 });
  }

  const eta = await calculateEta(shipmentId, lat, lng);
  return NextResponse.json(eta);
}
