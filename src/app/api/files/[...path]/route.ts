// src/app/api/files/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (!parts.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const root = path.join(process.cwd(), 'storage', 'uploads');
  const filePath = path.join(root, ...parts);
  if (!filePath.startsWith(root + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const buf = await readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
  }
}
