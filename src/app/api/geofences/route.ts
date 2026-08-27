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
    const shape = (body.shape === 'POLYGON' ? 'POLYGON' : 'CIRCLE') as string;
    if (!body.name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });
    if (shape === 'POLYGON') {
      const pts = Array.isArray(body.points) ? body.points : null;
      if (!pts || pts.length < 3) return NextResponse.json({ error: 'Polygon minimal 3 titik' }, { status: 400 });
      if (pts.length > 100) return NextResponse.json({ error: 'Polygon maksimal 100 titik' }, { status: 400 });
      for (const p of pts) {
        const lat = Array.isArray(p) ? Number(p[0]) : Number((p as any)?.lat);
        const lng = Array.isArray(p) ? Number(p[1]) : Number((p as any)?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return NextResponse.json({ error: 'Koordinat polygon tidak valid' }, { status: 400 });
        }
      }
      // Simpan centroid sebagai latitude/longitude legacy agar query lama tetap ada
      let cLat = 0, cLng = 0;
      for (const p of pts) { cLat += Array.isArray(p) ? Number(p[0]) : Number((p as any).lat); cLng += Array.isArray(p) ? Number(p[1]) : Number((p as any).lng); }
      cLat /= pts.length; cLng /= pts.length;
      const normalized = pts.map((p: any) => Array.isArray(p) ? { lat: Number(p[0]), lng: Number(p[1]) } : { lat: Number(p.lat), lng: Number(p.lng) });
      const gf = await prisma.geofence.create({
        data: {
          name: body.name,
          latitude: cLat,
          longitude: cLng,
          radiusMeters: 0,
          shape: 'POLYGON',
          points: normalized as any,
          type: body.type || 'OPERATIONAL_AREA',
          description: body.description || null,
          active: body.active !== false,
        },
      });
      await logAudit(session, 'CREATE_GEOFENCE', 'GEOFENCE', { newData: gf }, req);
      return NextResponse.json(gf, { status: 201 });
    }
    if (body.latitude == null || body.longitude == null) {
      return NextResponse.json({ error: 'Nama dan koordinat wajib diisi' }, { status: 400 });
    }
    const gf = await prisma.geofence.create({
      data: {
        name: body.name,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        radiusMeters: Number(body.radiusMeters) || 500,
        shape: 'CIRCLE',
        points: null as any,
        type: body.type || 'OPERATIONAL_AREA',
        description: body.description || null,
        active: body.active !== false,
      },
    });
    await logAudit(session, 'CREATE_GEOFENCE', 'GEOFENCE', { newData: gf }, req);
    return NextResponse.json(gf, { status: 201 });
  });
}