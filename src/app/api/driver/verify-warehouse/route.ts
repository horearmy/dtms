import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

// Memverifikasi QR kode gudang asal. Driver wajib scan saat tiba di gudang
// untuk konfirmasi kepulangan. Karena driver berada di tenant yang sama,
// verifikasi dilakukan terhadap warehouse milik tenant (bukan dari body).
export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.DELIVERY.COMPLETE);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const code = (req.nextUrl.searchParams.get('code') || '').trim();
    if (!code) return NextResponse.json({ error: 'Kode gudang wajib diisi' }, { status: 400 });

    const normalized = code.replace(/^WH[:#]/i, '');
    if (!session?.tenantId) {
      return NextResponse.json({ error: 'Sesi tidak memiliki organisasi' }, { status: 403 });
    }
    const warehouse = await prisma.warehouse.findFirst({
      where: { code: normalized, tenantId: session.tenantId, active: true },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!warehouse) {
      return NextResponse.json({ error: 'Kode gudang tidak valid untuk organisasi Anda' }, { status: 404 });
    }

    return NextResponse.json({ warehouse });
  });
}
