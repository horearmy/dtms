import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, logAudit, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.READ);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('pageSize') || '20', 10)));
    const search = req.nextUrl.searchParams.get('q') || '';

    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { code: { contains: search, mode: 'insensitive' as const } }, { city: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [total, warehouses] = await Promise.all([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({ items: warehouses, total, page, pageSize });
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.WAREHOUSE.CREATE);
  if (error) return error;
  return runWithTenant(session?.tenantId ?? null, async () => {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ error: 'Nama gudang wajib diisi' }, { status: 400 });
    }
    const effectiveTenantId = session?.role === 'SUPER_ADMIN' ? (body.tenantId || session?.tenantId) : session?.tenantId;
    if (!effectiveTenantId) {
      return NextResponse.json({ error: 'tenantId wajib diisi untuk super admin' }, { status: 400 });
    }
    try {
      const warehouse = await prisma.warehouse.create({
        data: {
          tenantId: effectiveTenantId,
          name: body.name,
          code: body.code || undefined,
          address: body.address || undefined,
          city: body.city || undefined,
          latitude: body.latitude != null ? Number(body.latitude) : undefined,
          longitude: body.longitude != null ? Number(body.longitude) : undefined,
          radiusMeters: body.radiusMeters != null ? Number(body.radiusMeters) : undefined,
          active: body.active !== undefined ? Boolean(body.active) : true,
        },
      });
      await logAudit(session, 'CREATE_WAREHOUSE', 'WAREHOUSE', { newData: warehouse }, req);
      return NextResponse.json(warehouse, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Unique constraint')) {
        return NextResponse.json({ error: 'Kode gudang sudah digunakan' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Gagal menyimpan gudang' }, { status: 500 });
    }
  });
}
