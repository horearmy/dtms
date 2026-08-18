// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes, createHash } from 'crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

function extOf(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'application/pdf') return 'pdf';
  return 'jpg';
}

export async function POST(req: NextRequest) {
  const { session, error } = await guard();
  if (error) return error;

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

  const tenantId = session?.tenantId || 'public';
  const fileId = randomBytes(8).toString('hex');
  const ext = extOf(file.type);
  const filename = `${Date.now()}-${fileId}.${ext}`;
  const objectKey = `${tenantId}/${category}/${filename}`;

  const dir = path.join(process.cwd(), 'storage', 'uploads', tenantId, category);
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  const checksum = createHash('md5').update(buf).digest('hex');
  await writeFile(path.join(dir, filename), buf);

  const record = await prisma.uploadedFile.create({
    data: {
      tenantId: session?.tenantId || null,
      objectKey,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      checksum,
      uploadedById: session?.id || null,
      category,
      shipmentId,
    },
  });

  return NextResponse.json({
    id: record.id,
    url: `/api/files/${objectKey}`,
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
  }, { status: 201 });
}
