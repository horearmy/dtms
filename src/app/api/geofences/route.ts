import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard, logAudit } from '@/lib/api-guard';

const MANAGE = ['SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER', 'SUPERVISOR'];

export async function GET() {
  const { error } = await guard(...MANAGE);
  if (error) return error;
  const geofences = await prisma.geofence.findMany({
    orderBy: { createdAt: 'desc' },
    include: { events: { orderBy: { createdAt: 'desc' }, take: 3, include: { driver: true } } },
  });
  return NextResponse.json(geofences);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;
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
  await logAudit(session, 'CREATE_GEOFENCE', 'GEOFENCE', `${gf.name}`);
  return NextResponse.json(gf, { status: 201 });
}