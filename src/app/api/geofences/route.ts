import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  const { session, error } = await guardPermission(PERMISSIONS.GEOFENCE.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const geofences = await prisma.geofence.findMany({
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 3, include: { driver: true } } },
    });
    return NextResponse.json(geofences);
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.GEOFENCE.CREATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    if (!body.name || body.latitude == null || body.longitude == null) {
      return NextResponse.json({ error: 'Nama dan koordinat wajib diisi' }, { status: 400 });
    }
    const gf = await prisma.geofence.create({
      data: {
        name: body.name,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        radiusMeters: Number(body.radiusMeters) || 500,
        type: body.type || 'OPERATIONAL_AREA',
        description: body.description || null,
        active: body.active !== false,
      },
    });
    await logAudit(session, 'CREATE_GEOFENCE', 'GEOFENCE', { newData: gf }, req);
    return NextResponse.json(gf, { status: 201 });
  });
}