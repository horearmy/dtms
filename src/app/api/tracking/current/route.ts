// src/app/api/tracking/current/route.ts
// Returns the latest GPS positions for all active drivers in a tenant.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  const tenantFilter = session?.tenantId ? { tenantId: session.tenantId } : {};

  // Get latest GPS per active driver using raw SQL
  const rows = await prisma.$queryRaw<
    { driverId: string; vehicleId: string | null; latitude: number; longitude: number; speed: number | null; heading: number | null; battery: number | null; createdAt: Date }[]
  >`
    SELECT DISTINCT ON ("driverId")
      "driverId", "vehicleId", "latitude", "longitude", "speed", "heading", "battery", "createdAt"
    FROM "GpsLog"
    WHERE "createdAt" > NOW() - INTERVAL '2 hours'
    ORDER BY "driverId", "createdAt" DESC
  `;

  return NextResponse.json(
    rows.map((r) => ({
      driverId: r.driverId,
      vehicleId: r.vehicleId,
      latitude: r.latitude,
      longitude: r.longitude,
      speed: r.speed,
      heading: r.heading,
      battery: r.battery,
      lastUpdate: r.createdAt,
    })),
  );
}
