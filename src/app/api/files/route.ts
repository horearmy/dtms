// src/app/api/files/route.ts
// List uploaded files for the current tenant.
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.FILE.READ);
  if (error) return error;

  const url = new URL(req.url);
  const category = url.searchParams.get('category') || undefined;
  const shipmentId = url.searchParams.get('shipmentId') || undefined;

  const files = await prisma.uploadedFile.findMany({
    where: {
      ...(session?.tenantId ? { tenantId: session.tenantId } : {}),
      ...(category ? { category } : {}),
      ...(shipmentId ? { shipmentId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(files.map((f) => ({
    id: f.id,
    fileName: f.fileName,
    url: `/api/files/${f.objectKey}`,
    mimeType: f.mimeType,
    size: f.size,
    category: f.category,
    shipmentId: f.shipmentId,
    createdAt: f.createdAt,
  })));
}
