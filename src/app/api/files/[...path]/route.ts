// src/app/api/files/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFile } from '@/lib/storage';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { path: parts } = await params;
  if (!parts.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const key = parts.join('/');
  const tenantMatch = key.match(/^tenant\/([^/]+)(?:\/|$)/);
  if (session.role !== 'SUPER_ADMIN') {
    const fileTenant = tenantMatch?.[1];
    if (!session.tenantId || !fileTenant || fileTenant !== session.tenantId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }
  }

  const result = await getFile(key);

  if (!result) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': result.mimeType,
      // File dilindungi autentikasi dan tidak boleh masuk shared cache.
      'Cache-Control': 'private, no-store',
    },
  });
}
