import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {
    name: body.name,
    latitude: body.latitude != null ? Number(body.latitude) : undefined,
    longitude: body.longitude != null ? Number(body.longitude) : undefined,
    radiusMeters: body.radiusMeters != null ? Number(body.radiusMeters) : undefined,
    type: body.type,
    description: body.description,
    active: body.active,
  };
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

  const before = await prisma.geofence.findUnique({ where: { id } });
  const gf = await prisma.geofence.update({ where: { id }, data });
  await logAudit(session, 'UPDATE_GEOFENCE', 'GEOFENCE', { oldData: before, newData: gf }, req);
  return NextResponse.json(gf);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL');
  if (error) return error;
  const { id } = await params;
  const gf = await prisma.geofence.findUnique({ where: { id } });
  await prisma.geofence.delete({ where: { id } });
  await logAudit(session, 'DELETE_GEOFENCE', 'GEOFENCE', { oldData: gf }, req);
  return NextResponse.json({ ok: true });
}