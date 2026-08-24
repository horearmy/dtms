// src/app/api/tracking/current/route.ts
// Returns the latest GPS positions for all active drivers in a tenant.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, runWithTenant } from '@/lib/api-guard';
import { Prisma } from '@prisma/client';

export async function GET() {
  const { session, error } = await guard();
  if (error) return error;

  // Posisi seluruh armada hanya untuk role operasional — driver/cs/gudang tidak boleh melihat
  const FLEET_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER'];
  if (!session || !FLEET_VIEW_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  return runWithTenant(session?.tenantId ?? null, async () => {
    const tenantCondition = session?.tenantId
      ? Prisma.sql`AND d."tenantId" = ${session.tenantId}`
      : Prisma.sql``;

    const rows = await prisma.$queryRaw<
      { driverId: string; vehicleId: string | null; latitude: number; longitude: number; speed: number | null; heading: number | null; battery: number | null; createdAt: Date }[]
    >`
      SELECT DISTINCT ON (g."driverId")
        g."driverId", g."vehicleId", g."latitude", g."longitude", g."speed", g."heading", g."battery", g."createdAt"
      FROM "GpsLog" g
      JOIN "Driver" d ON d."id" = g."driverId"
      WHERE g."createdAt" > NOW() - INTERVAL '2 hours'
      ${tenantCondition}
      ORDER BY g."driverId", g."createdAt" DESC
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
  });
}
