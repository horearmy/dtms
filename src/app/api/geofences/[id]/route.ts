import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.GEOFENCE.UPDATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {
      name: body.name,
      latitude: body.latitude != null ? Number(body.latitude) : undefined,
      longitude: body.longitude != null ? Number(body.longitude) : undefined,
      radiusMeters: body.radiusMeters != null ? Number(body.radiusMeters) : undefined,
      shape: body.shape,
      points: body.points,
      type: body.type,
      description: body.description,
      active: body.active,
    };
    // Validasi polygon jika shape diubah
    if (body.shape === 'POLYGON') {
      const pts = body.points;
      if (!Array.isArray(pts) || pts.length < 3) return NextResponse.json({ error: 'Polygon minimal 3 titik' }, { status: 400 });
      if (pts.length > 100) return NextResponse.json({ error: 'Polygon maksimal 100 titik' }, { status: 400 });
      for (const p of pts) {
        const lat = Array.isArray(p) ? Number(p[0]) : Number((p as any)?.lat);
        const lng = Array.isArray(p) ? Number(p[1]) : Number((p as any)?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return NextResponse.json({ error: 'Koordinat polygon tidak valid' }, { status: 400 });
        }
      }
      let cLat = 0, cLng = 0;
      for (const p of pts) { cLat += Array.isArray(p) ? Number(p[0]) : Number((p as any).lat); cLng += Array.isArray(p) ? Number(p[1]) : Number((p as any).lng); }
      cLat /= pts.length; cLng /= pts.length;
      (data as any).latitude = cLat;
      (data as any).longitude = cLng;
      (data as any).radiusMeters = 0;
      (data as any).points = pts.map((p: any) => Array.isArray(p) ? { lat: Number(p[0]), lng: Number(p[1]) } : { lat: Number(p.lat), lng: Number(p.lng) });
      (data as any).shape = 'POLYGON';
    } else if (body.shape === 'CIRCLE') {
      (data as any).shape = 'CIRCLE';
      (data as any).points = null;
    }
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

    const before = await prisma.geofence.findUnique({ where: { id } });
    const gf = await prisma.geofence.update({ where: { id }, data });
    await logAudit(session, 'UPDATE_GEOFENCE', 'GEOFENCE', { oldData: before, newData: gf }, req);
    return NextResponse.json(gf);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guardPermission(PERMISSIONS.GEOFENCE.DELETE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const { id } = await params;
    const gf = await prisma.geofence.findUnique({ where: { id } });
    await prisma.geofence.delete({ where: { id } });
    await logAudit(session, 'DELETE_GEOFENCE', 'GEOFENCE', { oldData: gf }, req);
    return NextResponse.json({ ok: true });
  });
}