import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { executeBillingRun } from '@/lib/billing-engine';

// GET â€” riwayat billing run (superadmin only)
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const runs = await prisma.billingRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return NextResponse.json({ runs });
}

// POST â€” jalankan billing run bulanan (idempotent per periode+runType)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const year = parseInt(String(body.year), 10);
  const month = parseInt(String(body.month), 10);
  if (!(year >= 2020 && year <= 2100) || !(month >= 1 && month <= 12)) {
    return NextResponse.json({ error: 'Parameter year/month tidak valid' }, { status: 400 });
  }
  try {
    const result = await executeBillingRun({
      year,
      month,
      runType: String(body.runType || 'MANUAL').toUpperCase(),
      actor: session.id as string,
    });
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Billing run gagal' },
      { status: 500 }
    );
  }
}
