// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardPermission, runWithTenant } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { uploadFile, getFileUrl } from '@/lib/storage';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/x-icon', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  'image/x-icon': [[0x00, 0x00, 0x01, 0x00]], // ICO header
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

function verifyMimeType(buf: Buffer, declaredType: string): boolean {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;
  return signatures.some(sig => sig.every((byte, i) => buf[i] === byte));
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardPermission(PERMISSIONS.FILE.UPLOAD);
  if (error) return error;

  return runWithTenant(session?.tenantId ?? null, async () => {
    try {
      const form = await req.formData();
    const file = form.get('file');
    const category = (form.get('category') as string) || 'general';
    const shipmentId = (form.get('shipmentId') as string) || null;

    if (category === 'branding' && !session?.tenantId) {
      return NextResponse.json({ error: 'Upload branding harus terkait tenant' }, { status: 403 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type) || (category === 'branding' && !file.type.startsWith('image/'))) {
      return NextResponse.json({ error: 'Format file harus JPG, PNG, WebP, atau PDF' }, { status: 400 });
    }
    const maxBytes = category === 'branding' ? 2 * 1024 * 1024 : MAX_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `Ukuran file maksimal ${category === 'branding' ? '2MB' : '10MB'}` }, { status: 400 });
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

    if (!verifyMimeType(buf, file.type)) {
      return NextResponse.json({ error: 'File content tidak sesuai dengan tipe yang dideklarasikan' }, { status: 400 });
    }

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
    } catch (e) {
      console.error('[upload] error', e);
      const msg = e instanceof Error ? e.message : 'Gagal upload';
      if (msg.includes('TENANT_CONTEXT_MISSING') || msg.includes('TENANT_MISMATCH')) {
        return NextResponse.json({ error: 'Konteks tenant hilang. Silakan login ulang.' }, { status: 401 });
      }
      return NextResponse.json({ error: msg || 'Gagal upload' }, { status: 500 });
    }
  });
}
