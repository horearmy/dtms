import { NextRequest, NextResponse } from 'next/server';
import { guard } from '@/lib/api-guard';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

function extOf(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function POST(req: NextRequest) {
  const { error } = await guard('SUPER_ADMIN', 'ADMIN_OPERASIONAL', 'DISPATCHER');
  if (error) return error;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format gambar harus JPG, PNG, atau WebP' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Ukuran gambar maksimal 5MB' }, { status: 400 });
  }

  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}.${extOf(file.type)}`;
  const dir = path.join(process.cwd(), 'storage', 'uploads', 'vehicles');
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);

  return NextResponse.json({ url: `/api/files/vehicles/${filename}` });
}
