// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { uploadFile, getFileUrl } from '@/lib/storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.FILE.UPLOAD);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    const form = await req.formData();
    const file = form.get('file');
    const category = (form.get('category') as string) || 'general';
    const shipmentId = (form.get('shipmentId') as string) || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format file harus JPG, PNG, WebP, atau PDF' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
    }

    // Check plan storage limit
    if (session?.tenantId) {
      const [storageRow] = await prisma.$queryRaw<[{ bytes: bigint }]>`
        SELECT COALESCE(SUM(size), 0)::bigint AS bytes
        FROM "UploadedFile" u
        JOIN "User" usr ON u."uploadedById" = usr.id
        WHERE usr."tenantId" = ${session.tenantId}
      `;
      const storageUsed = Number(storageRow?.bytes || 0);
      const tenant = await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { maxStorageMb: true } });
      const maxBytes = (tenant?.maxStorageMb || 50) * 1024 * 1024;
      if (maxBytes > 0 && storageUsed + file.size > maxBytes) {
        return NextResponse.json({ error: 'Batas storage tercapai. Upgrade plan untuk menambah storage.' }, { status: 403 });
      }
    }

    const tenantId = session?.tenantId || 'public';
    const buf = Buffer.from(await file.arrayBuffer());

    const result = await uploadFile({
      tenantId,
      category,
      entityId: shipmentId || undefined,
      fileName: file.name,
      mimeType: file.type,
      buffer: buf,
    });

    const record = await prisma.uploadedFile.create({
      data: {
        objectKey: result.key,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        checksum: result.checksum,
        uploadedById: session?.id || null,
        category,
        shipmentId,
      },
    });

    return NextResponse.json({
      id: record.id,
      url: getFileUrl(result.key),
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    }, { status: 201 });
  });
}
