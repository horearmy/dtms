import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFile } from '@/lib/storage';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, error } = await guardPermission(PERMISSIONS.DRIVER.READ);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const driver = await prisma.driver.findUnique({
      where: { id },
      select: { photo: true },
    });
    if (!driver?.photo) return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });

    const match = driver.photo.match(/\/api\/files\/(.+)$/);
    if (!match) return NextResponse.json({ error: 'Foto tidak valid' }, { status: 404 });

    const file = await getFile(match[1]);
    if (!file) return NextResponse.json({ error: 'File foto tidak ditemukan' }, { status: 404 });

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
